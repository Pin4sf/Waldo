# OneSync — Supabase Backend Architecture

Last updated: March 6, 2026

---

## Why Supabase

- Postgres with full SQL power (pg_cron, pg_net, pgmq, pgvector)
- Edge Functions (Deno runtime) — serverless, same language as app
- Built-in Auth (email, OAuth, anonymous)
- Realtime subscriptions (for future live dashboard updates)
- PowerSync integration for offline-first SQLite sync
- Free tier: 500MB DB, 2GB bandwidth, 500K Edge Function invocations/month
- Row Level Security built into Postgres

---

## Database Schema

### Core Tables

```sql
-- Users (extends Supabase auth.users)
create table user_profiles (
  id uuid primary key references auth.users(id),
  display_name text,
  chronotype text default 'normal', -- 'early', 'normal', 'late'
  timezone text default 'Asia/Kolkata',
  preferred_channel text default 'telegram',
  onboarding_complete boolean default false,
  crs_weights jsonb default '{"sleep":0.35,"hrv":0.25,"activity":0.20,"circadian":0.20}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Health snapshots (every 15 min from background sync)
create table health_snapshots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  recorded_at timestamptz not null,
  source text not null, -- 'health_connect', 'samsung_sensor', 'garmin_ciq', 'fitbit_api', etc.

  -- Vitals
  heart_rate int,
  hrv_rmssd real,
  spo2 real,
  skin_temp real,
  respiratory_rate real,
  steps_total int,
  steps_last_2h int,
  calories int,

  -- Computed
  crs_score real,
  crs_components jsonb, -- {sleep: 72, hrv: 65, activity: 80, circadian: 70}
  stress_level real, -- 0-1 severity

  -- Raw (for debugging/recomputation)
  raw_ibi jsonb, -- array of IBI values in ms

  created_at timestamptz default now()
);

-- Sleep sessions
create table sleep_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  sleep_start timestamptz not null,
  sleep_end timestamptz not null,
  duration_minutes int,
  deep_minutes int,
  rem_minutes int,
  light_minutes int,
  awake_minutes int,
  efficiency real,
  avg_hr real,
  avg_hrv real,
  sleep_score real,
  source text not null,
  created_at timestamptz default now()
);

-- Personal baselines (rolling averages)
create table health_baselines (
  user_id uuid references auth.users(id) primary key,
  resting_hr real,
  hrv_7day real,
  hrv_30day real,
  avg_steps_7day real,
  avg_sleep_duration_7day real,
  avg_sleep_score_7day real,
  avg_crs_7day real,
  updated_at timestamptz default now()
);

-- Core memory (agent-managed persistent profile)
create table core_memory (
  user_id uuid references auth.users(id) not null,
  key text not null,
  value text not null,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

-- Conversation history
create table conversation_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  channel text not null,
  role text not null, -- 'user' or 'assistant'
  content text not null,
  metadata jsonb, -- trigger_type, model_used, etc.
  created_at timestamptz default now()
);

-- Stress events (logged when multi-signal gate triggers)
create table stress_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  detected_at timestamptz not null,
  severity text not null, -- 'mild', 'moderate', 'high'
  hrv_drop_pct real,
  hr_elevation_pct real,
  persist_minutes int,
  intervention_sent boolean default false,
  user_feedback text, -- 'helpful', 'not_helpful', null
  created_at timestamptz default now()
);

-- Channel linking
create table channel_links (
  user_id uuid references auth.users(id) not null,
  channel text not null, -- 'telegram', 'whatsapp'
  channel_user_id text not null,
  linked_at timestamptz default now(),
  primary key (user_id, channel)
);

create table linking_codes (
  code text primary key,
  user_id uuid references auth.users(id),
  channel text not null,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '5 minutes',
  used boolean default false
);

-- Device connections
create table connected_devices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  device_type text not null, -- 'samsung_watch', 'garmin', 'fitbit', 'oura', 'whoop'
  device_name text,
  connection_type text not null, -- 'sensor_sdk', 'connect_iq', 'cloud_api', 'health_connect'
  oauth_tokens jsonb, -- encrypted, for cloud APIs
  last_sync_at timestamptz,
  created_at timestamptz default now()
);
```

### Indexes

```sql
-- Most critical: health snapshots queried by user + time
create index idx_health_user_time on health_snapshots(user_id, recorded_at desc);

-- Sleep by user + date
create index idx_sleep_user_start on sleep_sessions(user_id, sleep_start desc);

-- Conversation history for agent context loading
create index idx_convo_user_time on conversation_history(user_id, created_at desc);

-- Stress events for history view
create index idx_stress_user_time on stress_events(user_id, detected_at desc);

-- Channel lookup (for incoming webhooks)
create index idx_channel_links_channel on channel_links(channel, channel_user_id);
```

---

## Row Level Security (RLS)

### Performance-Optimized Pattern

```sql
-- FAST: auth.uid() cached via initPlan
-- The (select auth.uid()) wrapper forces Postgres to evaluate once, not per-row
alter table health_snapshots enable row level security;

create policy "Users read own health data"
  on health_snapshots for select
  using ((select auth.uid()) = user_id);

create policy "Users insert own health data"
  on health_snapshots for insert
  with check ((select auth.uid()) = user_id);

-- Apply same pattern to all user-scoped tables
-- DO NOT use: using (auth.uid() = user_id)  -- this is slow (evaluated per row)
-- DO use:     using ((select auth.uid()) = user_id)  -- cached, fast
```

### Service Role for Edge Functions

Edge Functions that process messages or run background tasks use the `service_role` key, which bypasses RLS. This is necessary because:
- Webhook functions don't have a user JWT
- Background tasks process data for multiple users
- The service validates user context in application code

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // Bypasses RLS
);
```

---

## Edge Functions

### Architecture

| Function | Trigger | Rate | Notes |
|----------|---------|------|-------|
| `telegram-webhook` | Telegram POST | Per message | Validates, routes to message-processor |
| `whatsapp-webhook` | WhatsApp GET/POST | Per message | Verifies signature, routes to message-processor |
| `message-processor` | Invoked by webhooks & triggers | Per event | Runs Claude agent loop |
| `message-sender` | pg_cron (10s) | 6/min | Dequeues and delivers outbound messages |
| `check-triggers` | pg_cron (1 min) | 1/min | Evaluates stress gates for all users with new data |
| `morning-brief` | pg_cron (per user schedule) | 1/user/day | Generates morning briefing |
| `compute-baselines` | pg_cron (daily 4am) | 1/day | Recomputes rolling baselines for all users |
| `process-health-data` | Invoked by app on sync | Per sync | Computes CRS, detects stress, stores snapshot |
| `adjust-crs-weights` | pg_cron (weekly) | 1/week | Adjusts CRS weights based on accumulated feedback |

### Edge Function Limits (Supabase Free Tier)

| Limit | Value |
|-------|-------|
| Invocations/month | 500,000 |
| Execution time | 150s (wall clock) |
| Memory | 256MB |
| Payload size | 6MB request, 6MB response |
| Concurrent | 10 (free), 100+ (pro) |

### Cost Estimate at Scale

For 100 active users:
- Health syncs: 100 users * 96/day (every 15 min) = 9,600/day = 288,000/month
- User messages: ~10/user/day = 30,000/month
- Proactive messages: ~3/user/day = 9,000/month
- Background checks: ~4,320/month (1/min)
- Total: ~331,320/month — **within free tier (500K)**

---

## pg_cron + pg_net

### Triggering Edge Functions from Postgres

```sql
-- Enable extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Check stress triggers every minute
select cron.schedule(
  'check-triggers',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/check-triggers',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('time', now())
  );
  $$
);

-- Process message queue every 10 seconds
-- Note: pg_cron minimum is 1 minute. For 10s, use pg_cron to invoke
-- a function that processes multiple batches, or use Supabase Realtime.
select cron.schedule(
  'process-message-queue',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/message-sender',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Compute baselines daily at 4am IST
select cron.schedule(
  'compute-baselines',
  '30 22 * * *', -- 22:30 UTC = 4:00 IST
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/compute-baselines',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Storing Secrets in Vault

```sql
-- Store service role key in Supabase Vault (not hardcoded in cron)
select vault.create_secret('service_role_key', 'eyJ...');

-- Reference in pg_cron jobs
-- Use current_setting() with app.settings or vault functions
```

---

## PowerSync Integration

### How It Works

```
Phone App (React Native)
  |
  v
PowerSync SDK (SQLite)  <--->  PowerSync Service  <--->  Supabase Postgres
  |                              (cloud hosted)
  v
Local reads (instant)
Local writes --> upload queue --> synced to Supabase
```

### PowerSync Setup

```typescript
// lib/powerSync.ts
import { PowerSyncDatabase } from '@powersync/react-native';
import { SupabaseConnector } from './supabaseConnector';

const schema = new Schema([
  new Table({
    name: 'health_snapshots',
    columns: [
      new Column({ name: 'user_id', type: ColumnType.TEXT }),
      new Column({ name: 'recorded_at', type: ColumnType.TEXT }),
      new Column({ name: 'heart_rate', type: ColumnType.INTEGER }),
      new Column({ name: 'hrv_rmssd', type: ColumnType.REAL }),
      new Column({ name: 'crs_score', type: ColumnType.REAL }),
      new Column({ name: 'source', type: ColumnType.TEXT }),
      // ... other columns
    ],
  }),
  // ... other tables
]);

export const db = new PowerSyncDatabase({
  schema,
  database: { dbFilename: 'onesync.db' },
});

// Connect
const connector = new SupabaseConnector();
await db.connect(connector);
```

### Sync Rules (PowerSync Dashboard)

```yaml
# Only sync current user's data
bucket_definitions:
  user_data:
    parameters: SELECT token_parameters.user_id as user_id
    data:
      - SELECT * FROM health_snapshots WHERE user_id = bucket.user_id
      - SELECT * FROM sleep_sessions WHERE user_id = bucket.user_id
      - SELECT * FROM health_baselines WHERE user_id = bucket.user_id
      - SELECT * FROM core_memory WHERE user_id = bucket.user_id
      - SELECT * FROM stress_events WHERE user_id = bucket.user_id
```

### Conflict Resolution

PowerSync uses **last-write-wins** by timestamp. For OneSync:
- Health data writes come from one source (background task on phone) — conflicts rare
- Core memory updates come from agent (server-side) — phone is read-only
- If conflict: newer timestamp wins, which is correct for health data

---

## Auth & Linking

### Supabase Auth

```typescript
// Email/password for MVP
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
});

// Google OAuth (future)
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly',
  },
});
```

### Google Calendar & Gmail

Store OAuth tokens from Google sign-in. Use them in Edge Functions:

```typescript
// In morning-brief Edge Function
async function getUpcomingEvents(userId: string) {
  const tokens = await getOAuthTokens(userId, 'google');
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
    new URLSearchParams({
      timeMin: new Date().toISOString(),
      timeMax: endOfDay().toISOString(),
      maxResults: '10',
      orderBy: 'startTime',
      singleEvents: 'true',
    }),
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );
  return response.json();
}
```

---

## Data Retention

| Table | Retention | Reason |
|-------|-----------|--------|
| health_snapshots | 90 days detailed, daily summaries forever | Storage management |
| sleep_sessions | Forever | Long-term trends |
| conversation_history | 30 days full, summaries forever | Context window management |
| stress_events | Forever | Pattern analysis |
| raw_ibi in snapshots | 7 days | Large payload, only needed for recomputation |

```sql
-- Daily cleanup job
select cron.schedule(
  'data-retention',
  '0 3 * * *', -- 3am daily
  $$
  -- Remove raw IBI older than 7 days
  UPDATE health_snapshots SET raw_ibi = NULL
  WHERE recorded_at < now() - interval '7 days' AND raw_ibi IS NOT NULL;

  -- Remove detailed snapshots older than 90 days (keep daily aggregates)
  -- TODO: Create daily_summaries table and aggregate before deleting
  $$
);
```

---

## Cost Summary (Free Tier Capacity)

| Resource | Free Tier | OneSync Usage (100 users) | Headroom |
|----------|-----------|--------------------------|----------|
| Database | 500MB | ~200MB (90 days health data) | 60% |
| Bandwidth | 2GB/month | ~500MB | 75% |
| Edge Function calls | 500K/month | ~330K | 34% |
| Auth users | 50K MAU | 100 | 99.8% |
| Realtime | 200 concurrent | 10-20 | 90% |
| Storage | 1GB | ~50MB (no media) | 95% |

**Upgrade trigger**: ~200-300 active users will push Edge Function invocations past free tier. Supabase Pro: $25/month.
