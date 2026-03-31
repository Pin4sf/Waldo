# Waldo End-to-End Demo — Implementation Plan

**Date:** March 31, 2026
**Goal:** Full-context pitch demo — Waldo reads body + calendar + email + tasks + weather and messages on Telegram. Web dashboard for screen-share demos.
**Status:** Demo/showcase quality. Production rewrite follows.
**Estimated effort:** ~6 days

---

## Architecture

```
DATA SOURCES (Pre-seeded from Ark's exports)
  ├── Apple Health XML (289MB, 683K records, 856 days) ← DONE
  ├── Google Calendar (.ics, 2,871 lines) ← TO PARSE
  ├── Gmail (.mbox, 1.3GB — headers only) ← TO PARSE
  ├── Google Tasks (Tasks.json, 35KB) ← TO PARSE
  ├── Google Meet (conference history CSV) ← TO PARSE
  ├── Open-Meteo Weather (778 days) ← DONE
  └── Open-Meteo AQI (90 days) ← DONE
        │
        ▼
  health-parser (enhanced) → all 32 metrics computed
        │
        ▼
  Seed Script → Supabase Postgres
        │
   ┌────┴────────────┐
   ▼                  ▼
Supabase Edge Fns    Web Dashboard
  ├── invoke-agent   (enhanced waldo-demo)
  ├── telegram-bot
  └── check-triggers
        │
        ▼
  Telegram Bot (proactive + conversational)
```

---

## Workstream 1: Complete Data Parsers (~1 day)

### 1a. Calendar Parser (`calendar-parser.ts`)
- Input: `takeoutexport_ark/Takeout 5/Calendar/arkpatil2717@gmail.com.ics`
- Parse ICS format (VEVENT blocks)
- Output per day: `DayMeetingData`
  - meetingLoadScore (0-15, based on total meeting minutes / 480 * 15)
  - totalMeetingMinutes
  - eventCount
  - backToBackCount (events with <15min gap)
  - focusGaps (stretches >90min with no meetings)
  - boundaryViolations (meetings before 8am or after 7pm)
  - events[] (title, start, end, duration, attendeeCount)

### 1b. Gmail Parser (`gmail-parser.ts`)
- Input: `takeoutexport_ark/Takeout 4/Mail/All mail Including Spam and Trash.mbox`
- Parse MBOX format — HEADERS ONLY (From, To, Date, Subject line length, Message-ID, In-Reply-To)
- NEVER read email body content (privacy rule)
- Output per day: `DailyEmailMetrics`
  - totalEmails, sentCount, receivedCount
  - afterHoursCount (before 8am or after 7pm IST)
  - afterHoursRatio
  - uniqueThreads (count unique In-Reply-To chains)
  - volumeSpike (>2x 14-day average)

### 1c. Tasks Parser (`tasks-parser.ts`)
- Input: `takeoutexport_ark/Takeout 5/Tasks/Tasks.json`
- Parse Google Tasks JSON format
- Output per day: `TaskMetrics`
  - pendingCount (needsAction items as of that date)
  - overdueCount (past due date, still needsAction)
  - completedToday (completed on this date)
  - recentVelocity (7-day average completions/day)
  - completionRate (completed / total in last 14 days)

### 1d. Meet Parser (new `meet-parser.ts`)
- Input: `takeoutexport_ark/Takeout 5/Google Meet/ConferenceHistory/conference_history_records.csv`
- Enrich calendar events with actual meeting duration + participant count

### 1e. Re-run master-metrics with real data
Once parsers produce real calendar/email/task data:
- Cognitive Load (body + schedule + email + tasks) → real scores
- Burnout Trajectory → real 30-day trend
- Resilience → real 14-day composite
- Cross-source Spots → real correlations (high MLS + low CRS, etc.)

---

## Workstream 2: Supabase Schema + Seed Script (~1 day)

### 2a. Create Supabase project (manual)
- Project name: `waldo-demo`
- Region: South Asia (Mumbai)
- Enable extensions: pg_cron, pg_net

### 2b. Database schema (SQL migration)
Tables:
- `users` — id, name, age, timezone, chronotype, onboarding_profile, created_at
- `health_snapshots` — user_id, date, hr_avg, hrv_rmssd, sleep_duration, sleep_efficiency, deep_pct, rem_pct, steps, spo2, resting_hr, wrist_temp, vo2max, weather_json, aqi, strain_json, sleep_debt_json
- `crs_scores` — user_id, date, score, zone, confidence, sleep_json, hrv_json, circadian_json, activity_json, summary
- `stress_events` — user_id, date, start_time, end_time, duration_minutes, confidence, severity, components_json, explanation
- `spots` — user_id, date, time, type, severity, title, detail, signals_json
- `patterns` — user_id, type, confidence, summary, evidence_count, first_seen, last_seen
- `day_activity` — user_id, date, morning_wag, evening_review, spots_json, actions_json
- `calendar_events` — user_id, date, title, start_time, end_time, duration, attendee_count
- `email_metrics` — user_id, date, total, sent, received, after_hours, after_hours_ratio, threads, volume_spike
- `task_metrics` — user_id, date, pending, overdue, completed_today, velocity, completion_rate
- `master_metrics` — user_id, date, cognitive_load_json, burnout_json, resilience_json, cross_source_insights_json
- `conversation_history` — user_id, role, content, mode, created_at
- `core_memory` — user_id, key, value, updated_at
- `agent_logs` — trace_id, user_id, trigger_type, tools_called, iterations, total_tokens, latency_ms, quality_gates_json, delivery_status, estimated_cost, created_at
- `agent_evolutions` — user_id, trigger_type, source, context, change_type, change_value, confidence, applied, created_at

RLS on ALL user-data tables: `auth.uid() = user_id`

### 2c. Seed script (`tools/seed-supabase.ts`)
- Run health-parser pipeline in-memory
- Run new calendar/gmail/tasks parsers
- Compute all 32 metrics + spots + patterns + user intelligence
- Insert everything into Supabase via @supabase/supabase-js
- Create Ark's user profile with onboarding data
- Seed core_memory with user intelligence findings

---

## Workstream 3: Edge Functions — Agent + Telegram (~2 days)

### 3a. `invoke-agent/` — Agent loop
- Read user context from ALL tables (health + calendar + email + tasks + spots + patterns + memory)
- Assemble 11-section prompt using prompt-builder logic (ported from health-parser)
- Soul file with zone modifiers (ported from health-parser)
- Call Claude Haiku 4.5 with tool_use
- 8 tools: get_crs, get_sleep, get_stress_events, get_activity, get_schedule, read_memory, update_memory, send_message
- 3 iterations max, 50s timeout
- Dynamic tool subset per trigger type
- Log trace to agent_logs
- Return AgentResponse

### 3b. `telegram-bot/` — Webhook handler (grammY)
- webhookCallback pattern
- /start command → welcome message
- User text → invoke-agent with mode=conversational
- Proactive message delivery (called by check-triggers)
- Inline keyboard: 👍/👎 on every Waldo message
- Feedback → agent_evolutions table

### 3c. `check-triggers/` — pg_cron handler
- Called by pg_cron every 15 min via pg_net
- Morning Wag: check if time matches user's wake_time_estimate (±30min)
- Fetch Alert: check latest CRS + stress confidence against thresholds
- Rules pre-filter: skip Claude if CRS > 60 AND stress confidence < 0.3
- If trigger fires → invoke-agent → send via Telegram

### 3d. pg_cron setup
```sql
-- Every 15 minutes
SELECT cron.schedule('check-triggers', '*/15 * * * *', $$
  SELECT net.http_post(
    url := 'https://PROJECT.supabase.co/functions/v1/check-triggers',
    headers := '{"Authorization": "Bearer ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
```

---

## Workstream 4: Enhanced Web Dashboard (~1 day)

### 4a. Connect to Supabase
- Replace local API data loading with Supabase client
- Auth: anonymous sign-in for demo (no onboarding gate)
- Fetch from all tables for selected date

### 4b. Full MetricsDashboard
- All 32 metrics displayed (body + schedule + communication + tasks + master)
- Cross-source insights with evidence
- Burnout trajectory with trend visualization

### 4c. Enhanced Constellation
- All 1,498+ spots including cross-source (health + calendar + email + tasks)
- Pattern connections with confidence scores

### 4d. Real Chat
- Chat sends messages through invoke-agent Edge Function
- Waldo responds with full life context (not just health)
- Debug panel shows system prompt with all 6 dimensions

---

## Workstream 5: Mobile App (waldo-dev) → Supabase (~1.5 days)

Suyash's React Native app (`waldo-dev-review/packages/mobile`) already has ALL screens and components built with mock data. We wire it to the same Supabase backend.

### 5a. Supabase Client Setup
- Install `@supabase/supabase-js` + `expo-sqlite` (for auth session storage)
- Create `lib/supabase.ts` with anon key + project URL
- Anonymous sign-in on first launch

### 5b. Replace Mock Data with Real Queries
The app currently imports from `constants/mockData.ts`. Replace each with Supabase queries:

| Screen | Current Mock | Supabase Query |
|--------|-------------|----------------|
| **Dashboard** — NapScoreGauge | `napScore: 58` | `SELECT * FROM crs_scores WHERE date = today ORDER BY date DESC LIMIT 1` |
| **Dashboard** — MorningWagCard | Hardcoded message | `SELECT morning_wag FROM day_activity WHERE date = today` |
| **Dashboard** — AdjustmentCards | 2 mock adjustments | `SELECT actions FROM day_activity WHERE date = today` |
| **Dashboard** — HealthStatCards | Mock sleep debt, strain | `SELECT * FROM health_snapshots WHERE date = today` + `SELECT * FROM master_metrics WHERE date = today` |
| **Dashboard** — SpotCards | 3 mock spots | `SELECT * FROM spots WHERE date = today ORDER BY severity` |
| **Timeline** — Day dots | 14 hardcoded days | `SELECT date, score, zone FROM crs_scores ORDER BY date DESC LIMIT 30` |
| **Constellation** — Nodes | 6 mock nodes | `SELECT * FROM spots ORDER BY date DESC LIMIT 250` + `SELECT * FROM patterns` |
| **Chat** — Messages | 5 mock messages | `SELECT * FROM conversation_history ORDER BY created_at` + real invoke-agent calls |

### 5c. Live Chat Integration
- Chat input → POST to invoke-agent Edge Function
- Response displayed as Waldo message
- Store in conversation_history table
- Add 👍/👎 buttons on Waldo messages → feedback to agent_evolutions

### 5d. Real-Time Subscriptions (optional polish)
- Subscribe to `crs_scores` inserts → live NapScore updates
- Subscribe to `spots` inserts → new spots appear in dashboard
- Subscribe to `conversation_history` → messages from Telegram appear in app chat too

### 5e. Build & Run
- `npx expo prebuild` (for dev build)
- Test on physical iPhone via Expo Dev Client
- Verify all screens render with real data

---

## Workstream 6: Telegram Bot Live (~0.5 day)

### 6a. Setup
- Create bot via @BotFather
- Deploy telegram-bot Edge Function (--no-verify-jwt)
- Set bot token as Supabase secret
- Register webhook URL

### 6b. Test scenarios
- Morning Wag delivery at configured time
- Conversational reply ("How am I doing?")
- Fetch Alert when stress detected
- Feedback buttons (👍/👎)
- Ask about calendar ("What meetings do I have today?")
- Ask about patterns ("What's my worst day of the week?")

---

## What This Demo Proves

1. Waldo reads your body AND your life (6 data dimensions, not just health)
2. Proactive messaging works (Morning Wag arrives on Telegram without you asking)
3. The agent has real intelligence (cross-source patterns nobody else can see)
4. Constellation visualization shows months of connected patterns
5. Conversation is personal and context-aware (not generic health advice)
6. The cost model works (~$0.001 per Claude call with caching)

---

## What This Demo Does NOT Do (Deferred to Production)

- Real-time HealthKit/Health Connect sync (pre-seeded data only)
- On-phone CRS computation (computed server-side from seeded data)
- Multiple users (single user: Ark)
- Mobile app production build (using Expo Dev Client for demo)
- op-sqlite + SQLCipher local storage
- Background sync (WorkManager / BGTaskScheduler)
- Authentication beyond anonymous
- Production security hardening (5-layer defense)
- Agent self-evolution (table exists but not active)

---

## Execution Order

1. **Day 1**: Parse Google Takeout (calendar + gmail + tasks + meet) → re-run all 32 metrics
2. **Day 2**: Supabase project + schema + seed script → all data in the cloud
3. **Day 3**: invoke-agent Edge Function (full prompt builder + tools + Claude)
4. **Day 4**: telegram-bot + check-triggers Edge Functions + pg_cron
5. **Day 5**: Web dashboard connected to Supabase
6. **Day 6**: Mobile app (waldo-dev) wired to Supabase + testing + polish

---

## Prerequisites (User Action Needed)

- [ ] Create Supabase project at supabase.com (or provide access token for MCP)
- [ ] Create Telegram bot via @BotFather → save token
- [ ] Ensure Anthropic API key is available
- [ ] Confirm Ark's Apple Health export path (expected: already in repo)
