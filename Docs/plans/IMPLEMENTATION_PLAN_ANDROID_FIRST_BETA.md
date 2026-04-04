# Waldo Implementation Plan: 5-User Beta (Android Testing + iOS)

**Date:** April 4, 2026
**Goal:** 5 independent users, each with their own Waldo agent, connected data sources, working on Android + web console (+ iOS when Apple Dev account is purchased).
**Platform strategy:** iOS remains primary. Android is used for immediate testing/validation because Shivansh has an Android phone and no Apple Developer account ($99) yet. Both platforms are being built — HealthKit module (Swift) already exists, Health Connect module (Kotlin) needs to be built. Once validated and funded, buy Apple Dev account and distribute iOS app via TestFlight.
**iOS users in the meantime:** Use web console + Telegram + manual Apple Health export to get their own Waldo agent.

---

## Context for the Executing Agent

**Read these docs first (in order):**
1. `CLAUDE.md` (root) — project rules, tech stack, architecture
2. `.claude/rules/architecture.md` — locked decisions, data flow, adapter pattern
3. `.claude/rules/coding-standards.md` — TypeScript, React Native, naming, error handling
4. `.claude/rules/health-data-security.md` — NON-NEGOTIABLE security rules
5. `Docs/MVP_SCOPE.md` — what's in/out of scope

**Current state:**
- Phase A0 complete (CRS validated on 856 days of real data)
- Supabase backend live (24 tables, 17 Edge Functions deployed)
- Cloudflare DO built (1,476 LOC) but NOT deployed
- Mobile app exists (`waldo-app/`) — Expo 53, screens, HealthKit module (iOS only)
- Telegram bot working
- Web console deployed at waldo-sigma.vercel.app
- `waldo-dev-review/` has better UI components + Health Connect scaffolding
- NO tests exist anywhere

**What's working:** Telegram bot, invoke-agent EF, check-triggers, web console, seeded data for 1 user (Ark)
**What's NOT working:** Live wearable data pipeline, Google OAuth (needs credentials), Spotify (needs credentials), per-user Waldo agent (DO not deployed), Android build

---

## Architecture Overview

```
Android User Path:
  Phone (Health Connect) → waldo-app → op-sqlite → Supabase sync
  + Google OAuth (Calendar/Gmail/Tasks/Fit) via Edge Functions
  + Spotify OAuth via Edge Function
  + Location (GPS) → Open-Meteo weather API
  → Cloudflare DO (per-user Waldo brain)
  → Telegram (message delivery)

iOS User Path (no app yet):
  Web console (waldo-sigma.vercel.app) → sign up → connect Google/Spotify
  + Manual Apple Health export → health-import Edge Function
  + Telegram bot for messaging
  → Cloudflare DO (per-user Waldo brain)
  → Telegram (message delivery)

Per-User Agent (Cloudflare Durable Object):
  Each user gets ONE DO = their Waldo
  DO has: SQLite workspace, alarm scheduling, memory tiers, LLM calls
  DO reads health data FROM Supabase, stores only derived insights
  DO delivers messages via Telegram (and later WhatsApp, in-app)
```

---

## Phase 0: Workspace Cleanup [✅ DONE — April 4, 2026]

**Completed:**
- 0.2: .gitignore updated (Cloudflare entries, dead code markers)
- 0.3: Migration `20260404000002_anon_key_rotation_note.sql` created (user must rotate key in dashboard)
- 0.5: Components cherry-picked from waldo-dev-review:
  - `waldo-app/src/theme/index.ts` — brand tokens
  - `waldo-app/src/components/NapScoreGauge.tsx` — animated gauge
  - `waldo-app/src/components/MorningWagCard.tsx`
  - `waldo-app/src/components/ChatBubble.tsx`
  - `waldo-app/src/components/HealthStatCard.tsx`
  - `waldo-app/src/components/SpotCard.tsx`
  - `waldo-app/src/components/ZonePill.tsx`
  - `waldo-app/src/components/ui/AnimatedNumber.tsx`
  - `waldo-app/src/components/ui/InteractiveCard.tsx`

**Pending (requires rm -rf permission or user action):**
- 0.1: Delete `agent-runtime/`, `memory/` (root), `claude code source/`
- 0.4: Delete `supabase/functions/sync-youtube-music/`

---

## Phase 0: Workspace Cleanup [DO FIRST]

### Task 0.1: Remove dead code
Delete these directories/files entirely:
- `/agent-runtime/` — duplicates DO alarm system, not in any plan
- `/memory/` (root level) — stale scratch files (r2_archival_research.md, session6_team_demo.md)
- `/claude code source/` — reference material, 33MB, bloats repo

### Task 0.2: Update .gitignore
Add these entries to `.gitignore` if not already present:
```
# Large test data (never commit)
AppleHealthExport/
takeoutexport_ark/
claude code source/

# Cloudflare
.wrangler/
```

### Task 0.3: Remove Supabase anon key from git history
The file `supabase/migrations/20260402000001_multi_user_auth.sql` contains a hardcoded Supabase anon key (JWT starting with `eyJhbGci...`). This migration has already been applied to the database so the key works.

**Action:** Create a new migration that documents the key should come from environment:
```sql
-- Migration: document that anon key should be rotated
-- The anon key committed in migration 20260402000001 should be rotated
-- via Supabase dashboard: Settings > API > Regenerate anon key
-- Then update all clients (waldo-app, tools/waldo-demo) with the new key
COMMENT ON SCHEMA public IS 'Anon key rotation pending — see migration notes';
```

**User action required:** Rotate the anon key in Supabase dashboard after all clients are updated.

### Task 0.4: Remove sync-youtube-music Edge Function
Delete `supabase/functions/sync-youtube-music/` — not in any plan or scope doc.

### Task 0.5: Archive waldo-dev-review components
Cherry-pick these files FROM `/Users/shivansh.fulper/Github/personal/waldo-dev-review/packages/mobile/` INTO the main repo's `waldo-app/`:

**Components to copy** (create `waldo-app/src/components/` if needed):
- Any NapScoreGauge, MorningWagCard, SpotCard, ChatBubble, HealthStatCard, ZonePill components
- Copy the design tokens if they exist as a separate file

**DO NOT copy:**
- The login.tsx (main repo has its own auth flow via Supabase magic link)
- The Express backend (`packages/backend/`)
- The watch app scaffolding (`packages/watch-apple/`, `packages/watch-samsung/`)

After cherry-picking, document in this plan what was copied. The dev-review repo stays as-is (don't delete it — just don't maintain it).

---

## Phase 1: Android Data Pipeline [✅ CODE COMPLETE — April 4, 2026]

**Completed:**
- 1.1: Health Connect native module:
  - `modules/health-connect/expo-module.config.json`
  - `modules/health-connect/android/.../HealthConnectModule.kt` — reads HR, HRV (RMSSD or HR-proxy), Sleep, Steps, SpO2, RestingHR, Exercise
  - `modules/health-connect/android/.../HealthConnectPackage.kt`
  - `modules/health-connect/src/HealthConnectModule.ts` — TS bindings
  - `modules/health-connect/src/HealthConnectAdapter.ts` — implements `HealthDataSource` interface
  - Samsung HRV proxy: HR-variance × 6.5 approximates RMSSD when `HeartRateVariabilityRmssdRecord` absent
- 1.2: CRS engine updated (`src/crs/engine.ts` + `types.ts`):
  - Min components reduced: 0 components → `insufficient`, 1+ → computed score
  - Phone-only mode: score capped at 65 when no body signals (no HRV, no sleep)
  - Added `componentsAvailable: string[]` and `isPhoneOnlyMode: boolean` to `CrsResult`
  - Added `zone: 'insufficient'` to `CrsZone`
- 1.3: Location adapter:
  - `src/adapters/location/location-adapter.ts` — GPS + Open-Meteo (no API key)
  - 15-minute cache aligned with health sync cycle
  - Privacy: coords rounded to 2dp before any storage
- 1.4: Pipeline wired:
  - `health-pipeline.ts` — optional `LocationAdapter` parameter
  - Weather injected into `DailyHealthData` after GPS fetch
  - Migration `20260404000003_location_weather_columns.sql` created
- 1.5: `app.json` — Android Health Connect + location permissions added
- 1.5: `eas.json` created — `preview` profile builds APK (not AAB), no Play Store account needed

**Pending (requires human action):**
- Run `eas build --platform android --profile preview` to produce APK
- Install APK on Android device + test Health Connect permission flow

**Also fixed in Phase 2 prep:**
- Cloudflare DO admin key validation: now validates against `ADMIN_KEY` / `WALDO_WORKER_SECRET` env var
- Cost cap actually enforced: `isDailyCostCapReached()` called before every LLM call
- Cost tracked after every LLM call via `trackCost()`
- Pre-existing bug fixed: `crs.date` → `new Date().toISOString().slice(0, 10)`
- Interview mode added to DO: 5-question onboarding before patrol starts

---

## Phase 1: Android Data Pipeline [Week 1, Days 1-3]

### Task 1.1: Add Health Connect adapter to main repo

**What:** Create a Health Connect adapter that reads health data from Android's Health Connect API.

**Files to create:**
- `waldo-app/modules/health-connect/HealthConnectModule.kt` — Kotlin native module using Expo Modules API
- `waldo-app/modules/health-connect/HealthConnectModule.ts` — TypeScript bindings
- `waldo-app/src/adapters/health/health-connect-adapter.ts` — implements `HealthDataSource` interface

**Data types to read from Health Connect:**
| Data Type | Health Connect Class | Available From |
|-----------|---------------------|---------------|
| Heart Rate | `HeartRateRecord` | All watches that sync to Health Connect |
| HRV (RMSSD) | `HeartRateVariabilityRmssdRecord` | Pixel Watch, Fitbit (NOT Samsung, NOT Xiaomi) |
| Sleep stages | `SleepSessionRecord` | Samsung, Pixel, Fitbit, Amazfit |
| Steps | `StepsRecord` | All watches + phone |
| SpO2 | `OxygenSaturationRecord` | Samsung, Pixel (partial) |
| Exercise | `ExerciseSessionRecord` | All watches |
| Resting HR | `RestingHeartRateRecord` | Fitbit, Pixel Watch |
| Calories | `TotalCaloriesBurnedRecord` | All watches |

**Key implementation notes:**
- Use `expo-modules-core` for the native module bridge
- All queries are async — never block main thread
- Request permissions incrementally (one type at a time)
- Handle: permission denied, no data available, Health Connect not installed
- Return structured data matching the `DailyHealthData` type from `src/types/health.ts`
- For Samsung users (no HRV): set `deviceHrvSource: 'none'`, CRS engine handles dynamic weight redistribution

**Reference:** The existing HealthKit module at `waldo-app/modules/healthkit/` shows the pattern. Follow the same adapter interface.

**Acceptance:** `HealthConnectAdapter.queryDailyData(date)` returns health data on an Android device with Health Connect installed.

### Task 1.2: Dynamic CRS for partial data sources

**What:** Modify the CRS engine to work with whatever data is available, not just the full 4-component model.

**File:** `waldo-app/src/crs/engine.ts`

**Current behavior:** CRS expects sleep + HRV + circadian + activity (4 components, 25% each).

**Required behavior:** Dynamic weight redistribution based on available data:

```typescript
// If HRV unavailable (Samsung, Xiaomi, no watch):
//   Sleep: 35%, Circadian: 30%, Activity: 35%, HRV: 0%
// If Sleep unavailable (no watch worn overnight):
//   HRV: 35%, Circadian: 30%, Activity: 35%, Sleep: 0%
// If only steps available (phone only, no watch):
//   Activity: 50%, Circadian: 50% (circadian derived from phone usage patterns)
//   Score capped at 65 (max moderate — can't be "peak" without body data)
// Minimum: need at least 1 data source to compute CRS
// Return { score: -1, zone: 'insufficient' } if zero data sources
```

**Also add `componentsAvailable` to CrsResult:**
```typescript
interface CrsResult {
  score: number; // 0-100 or -1
  zone: 'peak' | 'moderate' | 'low' | 'insufficient';
  confidence: number; // 0-1, lower when fewer components available
  componentsAvailable: string[]; // ['sleep', 'activity'] etc.
  // ... existing fields
}
```

**Acceptance:** CRS computes a meaningful score with any combination of available data. Returns `insufficient` when nothing is available.

### Task 1.3: Location intelligence

**What:** Add GPS location tracking for accurate weather and place context.

**Files to create:**
- `waldo-app/src/adapters/location/location-adapter.ts`
- `waldo-app/src/services/location-service.ts`

**Implementation:**
1. Use `expo-location` for GPS access
2. Request `ACCESS_FINE_LOCATION` (foreground) + `ACCESS_BACKGROUND_LOCATION` (background)
3. Get location every 15 minutes (aligned with health sync cycle)
4. Call Open-Meteo API with actual lat/lon (no API key needed):
   ```
   https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code,uv_index&timezone=auto
   ```
5. Store in Supabase `health_snapshots` (add columns: `latitude`, `longitude`, `weather_temp_c`, `weather_code`, `uv_index`, `humidity`)
6. **Privacy:** Never log exact coordinates. Round to 2 decimal places (~1km precision) before storing. Agent sees "weather: 28C, humid, UV high" — not GPS coordinates.

**New Supabase migration required:**
```sql
ALTER TABLE health_snapshots 
  ADD COLUMN IF NOT EXISTS latitude REAL,
  ADD COLUMN IF NOT EXISTS longitude REAL,
  ADD COLUMN IF NOT EXISTS weather_temp_c REAL,
  ADD COLUMN IF NOT EXISTS weather_code INTEGER,
  ADD COLUMN IF NOT EXISTS uv_index REAL,
  ADD COLUMN IF NOT EXISTS humidity_pct REAL;
```

**Acceptance:** Weather data in health_snapshots is from actual GPS location, not estimated.

### Task 1.4: Wire the full Android data pipeline

**What:** Connect Health Connect adapter → CRS engine → op-sqlite → Supabase sync.

**File:** `waldo-app/src/services/health-pipeline.ts` (exists, needs Android path)

**Pipeline flow (Android):**
```
1. HealthConnectAdapter.queryDailyData(today)
   → Returns: { hr, hrv?, sleep?, steps, spo2?, exercise? }
2. LocationService.getCurrentWeather()
   → Returns: { temp, code, uv, humidity }
3. CRS engine: computeCrs(healthData, baselines)
   → Returns: CrsResult with dynamic weights
4. Write to op-sqlite (encrypted, SQLCipher)
5. Sync to Supabase (health_snapshots + crs_scores)
6. Background sync: Android WorkManager every 15 minutes
```

**Platform detection:**
```typescript
import { Platform } from 'react-native';

const healthAdapter = Platform.OS === 'ios'
  ? new HealthKitAdapter()
  : new HealthConnectAdapter();
```

**Background sync (Android):**
- Use Expo's `expo-background-fetch` or a custom WorkManager module
- Minimum interval: 15 minutes
- Must survive app being killed (foreground service notification on Samsung/Xiaomi)
- On wake: query Health Connect → compute CRS → sync to Supabase

**Acceptance:** On an Android phone with a smartwatch syncing to Health Connect, CRS updates every 15 minutes and appears in Supabase.

### Task 1.5: EAS Build for Android APK

**What:** Create a development/preview APK that can be shared with friends.

**Steps:**
1. Ensure `app.json` has correct Android config:
   ```json
   {
     "android": {
       "package": "com.waldo.app",
       "permissions": [
         "android.permission.health.READ_HEART_RATE",
         "android.permission.health.READ_SLEEP",
         "android.permission.health.READ_STEPS",
         "android.permission.health.READ_HEART_RATE_VARIABILITY",
         "android.permission.health.READ_OXYGEN_SATURATION",
         "android.permission.health.READ_EXERCISE",
         "android.permission.ACCESS_FINE_LOCATION",
         "android.permission.ACCESS_BACKGROUND_LOCATION"
       ]
     }
   }
   ```
2. Run: `eas build --platform android --profile preview`
3. This produces an APK (not AAB) that can be sideloaded

**Note:** EAS builds are free for the first 30 builds/month. No Google Play Developer account needed for APK distribution.

**Acceptance:** APK installs on Android phone, Health Connect permissions requestable, location works.

---

## Phase 2: Deploy Per-User Waldo Agent [Week 1, Days 3-5]

### Task 2.1: Deploy Cloudflare Durable Objects

**What:** Deploy the existing `cloudflare/waldo-worker/` to Cloudflare.

**Pre-requisites (user must do):**
1. Cloudflare account (free tier is sufficient)
2. Run: `cd cloudflare/waldo-worker && npx wrangler deploy`
3. Set secrets:
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put WALDO_WORKER_SECRET
   ```
4. Note the worker URL (e.g., `https://waldo-agent.shivansh.workers.dev`)

**Code changes needed:**
- Fix admin key validation in `agent.ts` line 254:
  ```typescript
  // Before (accepts any non-empty string):
  if (!adminKey) return json({ error: 'Unauthorized' }, 401);
  
  // After (validates against env var):
  const expectedKey = this.env.ADMIN_KEY ?? this.env.WALDO_WORKER_SECRET;
  if (adminKey !== expectedKey) return json({ error: 'Unauthorized' }, 401);
  ```

**Acceptance:** `curl https://waldo-agent.YOUR.workers.dev/health` returns `{"status":"ok"}`.

### Task 2.2: Add interview mode to DO

**What:** When a new user is provisioned, Waldo conducts a brief initial interview to calibrate personality and preferences.

**File:** `cloudflare/waldo-worker/src/agent.ts`

**Add new method: `handleInterview`**

The interview happens as a multi-turn conversation via the `/chat` endpoint. The DO tracks interview state in `agent_state`.

```typescript
// Interview questions (asked one at a time via chat)
const INTERVIEW_QUESTIONS = [
  { key: 'role', question: "What do you do? I'll use this to understand your day." },
  { key: 'stress_triggers', question: "What tends to wear you out or stress you the most?" },
  { key: 'schedule_pattern', question: "Walk me through a typical day — when do you start, peak, wind down?" },
  { key: 'communication_pref', question: "How do you want me to talk to you? Quick and direct, or more conversational?" },
  { key: 'goals', question: "One thing you'd want me to help you stay on top of?" },
];
```

**Flow:**
1. After provision, set `agent_state.interview_step = 0`
2. When user sends first chat message, check if `interview_step < INTERVIEW_QUESTIONS.length`
3. If in interview mode:
   - Save user's answer to `memory_blocks` with category 'profile'
   - Send next question (or ask Claude to generate a natural transition + next question)
   - Increment `interview_step`
4. After last question:
   - Set `interview_complete = true` in agent_state
   - Send: "Got it. I'll be watching. Your first Morning Wag arrives tomorrow at {wake_time}."
   - Schedule first patrol alarm
5. If user tries to skip: "No worries — I'll learn as we go. You can always tell me more later."

**Memory entries created from interview:**
```
user_role: "software engineer at Atlan"
stress_triggers: "back-to-back meetings, late-night work"
daily_pattern: "starts 9am, peaks 10-1pm, winds down 8pm"
communication_preference: "direct and brief"
primary_goal: "avoid burnout, manage energy"
```

**Acceptance:** New user provision → first chat message triggers interview → 5 questions → profile built → interview_complete = true.

### Task 2.3: Wire Edge Functions to route through DO

**What:** Update `check-triggers`, `user-register`, and `telegram-bot` Edge Functions to call the Cloudflare DO instead of handling agent logic locally.

**Changes:**

**`supabase/functions/user-register/index.ts`:**
- After creating user in Supabase, call DO `/provision/:userId`
- This already exists as fire-and-forget but needs the correct Worker URL

**`supabase/functions/check-triggers/index.ts`:**
- Instead of calling `invoke-agent` directly, call DO `/trigger/:userId`
- The DO handles all agent logic (pre-filter, LLM call, delivery)
- Keep the pg_cron trigger — it just becomes a "ping the DO" instead of "run the agent"

**`supabase/functions/telegram-bot/index.ts`:**
- For chat messages, call DO `/chat/:userId` instead of `invoke-agent`
- Keep linking code flow local (it's just DB lookups)
- Keep `/start`, `/status` commands local

**New shared config:**
```typescript
// supabase/functions/_shared/config.ts
export const CLOUDFLARE_WORKER_URL = Deno.env.get('CLOUDFLARE_WORKER_URL') ?? 'https://waldo-agent.YOUR.workers.dev';
export const WALDO_WORKER_SECRET = Deno.env.get('WALDO_WORKER_SECRET') ?? '';
```

**New Supabase secret required:** `CLOUDFLARE_WORKER_URL`, `WALDO_WORKER_SECRET`

**Acceptance:** Telegram message → telegram-bot EF → Cloudflare DO → response → Telegram. Morning Wag fires from DO alarm, not pg_cron Edge Function.

### Task 2.4: Add cost cap enforcement

**File:** `cloudflare/waldo-worker/src/agent.ts`

**What:** Actually enforce the `DAILY_COST_CAP_USD = 0.10` constant.

```typescript
// In the patrol loop and chat handler, before calling LLM:
const todayCost = parseFloat(getState(this.sql, 'daily_cost_usd') ?? '0');
const todayDate = getLocalDate(timezone);
const costResetDate = getState(this.sql, 'cost_reset_date');

if (costResetDate !== todayDate) {
  setState(this.sql, 'daily_cost_usd', '0');
  setState(this.sql, 'cost_reset_date', todayDate);
}

if (todayCost >= DAILY_COST_CAP_USD) {
  // Use template fallback — no LLM call
  log('warn', 'cost_cap_reached', { userId, todayCost });
  // Return template response from fallback-templates
  return;
}

// After LLM call:
const newCost = todayCost + result.costUsd;
setState(this.sql, 'daily_cost_usd', String(newCost));
```

**Acceptance:** After $0.10/day in LLM costs, Waldo switches to template responses.

---

## Phase 3: iOS User Path (Web Console + Telegram) [Week 2, Days 6-7]

### Task 3.1: Web console onboarding for non-app users

**What:** Enhance the web console (tools/waldo-demo/) so iOS users can sign up and connect their data sources without the mobile app.

**File:** `tools/waldo-demo/src/components/` (add new components)

**Flow:**
1. User visits waldo-sigma.vercel.app
2. Clicks "Get Started" → enters name, email, timezone
3. Calls `user-register` Edge Function → creates user + provisions DO
4. Shows connector cards:
   - Google Workspace → opens OAuth flow in popup → callback marks as connected
   - Spotify → opens OAuth flow in popup → callback marks as connected  
   - Telegram → shows 6-digit linking code + instructions
5. Shows "Waldo is ready" screen with:
   - "Your first Morning Wag arrives tomorrow via Telegram"
   - Link to Telegram bot
   - Option to upload Apple Health export (for iOS users)

**Apple Health export upload (for iOS users):**
- iOS users can export their health data from Apple Health app (Settings → Health → Export Health Data)
- This produces a ZIP file containing `export.xml`
- Add an upload component that:
  1. Accepts the ZIP file
  2. Sends it to a new Edge Function: `health-import` (already exists as scaffold)
  3. The Edge Function parses it using the same logic as `tools/health-parser/`
  4. Seeds the user's health data into Supabase
- This gives iOS users historical data for CRS computation

**Acceptance:** iOS user can sign up via web console, connect Google + Spotify + Telegram, optionally upload Apple Health export. Gets Morning Wag next day.

### Task 3.2: Enhance health-import Edge Function

**What:** Make the existing `supabase/functions/health-import/` accept Apple Health export uploads and parse them into the user's health data tables.

**Implementation:**
- Accept multipart/form-data with a ZIP file
- Extract `export.xml` from ZIP
- Use streaming XML parser (same approach as `tools/health-parser/xml-stream-parser.ts`, ported to Deno)
- Extract: HR, HRV, Sleep, Steps, SpO2, Exercise
- Write to `health_snapshots` and `crs_scores` for the authenticated user
- Process in chunks (Edge Function has 150s idle timeout — stream, don't buffer)

**Simplified version (if full XML parsing is too complex for EF):**
- Accept a JSON file instead — user runs `tools/health-parser/` locally or we provide a web-based converter
- The JSON matches the `health_snapshots` schema
- Edge Function just inserts the rows

**Acceptance:** iOS user uploads health data → appears in Supabase → Waldo DO can use it for Morning Wag.

---

## Phase 4: Connectors & Data Sync [Week 2, Days 8-9]

### Task 4.1: Set Google OAuth credentials

**User action (not code):**
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add redirect URI: `https://ogjgbudoedwxebxfgxpa.supabase.co/functions/v1/oauth-google/callback`
4. Enable APIs: Google Calendar API, Gmail API, Google Tasks API, Google Fitness API
5. Set Supabase secrets:
   ```bash
   supabase secrets set GOOGLE_CLIENT_ID=<value>
   supabase secrets set GOOGLE_CLIENT_SECRET=<value>
   supabase secrets set OAUTH_REDIRECT_SUCCESS_URL=https://waldo-sigma.vercel.app
   ```

### Task 4.2: Set Spotify credentials

**User action (not code):**
1. Go to developer.spotify.com → Create App
2. Set redirect URI: `https://ogjgbudoedwxebxfgxpa.supabase.co/functions/v1/oauth-spotify/callback`
3. Set Supabase secrets:
   ```bash
   supabase secrets set SPOTIFY_CLIENT_ID=<value>
   supabase secrets set SPOTIFY_CLIENT_SECRET=<value>
   ```

### Task 4.3: Set admin and worker secrets

**User action (not code):**
```bash
supabase secrets set ADMIN_API_KEY=<generate-a-strong-random-string>
supabase secrets set CLOUDFLARE_WORKER_URL=https://waldo-agent.YOUR.workers.dev
supabase secrets set WALDO_WORKER_SECRET=<generate-a-strong-random-string>
```

### Task 4.4: Wire Google Fit for Health Connect cloud sync

**What:** For Android users who also have Google Fit, the `sync-google-fit` Edge Function can pull additional data.

**File:** `supabase/functions/sync-google-fit/index.ts` (exists)

**Changes needed:**
- Ensure it writes to the same `health_snapshots` table with `source = 'google_fit'`
- Add logic to merge Google Fit data with Health Connect data (Health Connect takes priority for overlapping metrics)
- Schedule via pg_cron: daily at 4:30 AM UTC (already configured)

**Acceptance:** Users who connect Google Fit get supplementary health data even when phone isn't syncing Health Connect.

### Task 4.5: Add location data to agent context

**What:** Make the Cloudflare DO agent-aware of weather and location context.

**File:** `cloudflare/waldo-worker/src/supabase.ts`

**Add function:**
```typescript
export async function fetchWeatherContext(userId: string, env: Env): Promise<{
  temp_c: number | null;
  weather_description: string | null;
  uv_index: number | null;
  humidity: number | null;
} | null> {
  // Query latest health_snapshot with weather data
  // Return weather fields
}
```

**File:** `cloudflare/waldo-worker/src/agent.ts`

**In `buildUserContext`**, add weather:
```typescript
if (weather?.temp_c) parts.push(`Weather: ${weather.temp_c}C, ${weather.weather_description}`);
if (weather?.uv_index && weather.uv_index > 6) parts.push(`UV: ${weather.uv_index} (high)`);
```

**Acceptance:** Waldo's Morning Wag mentions weather when relevant ("Rough night, 28C and humid today — stay hydrated").

---

## Phase 5: Onboarding Flow (Mobile) [Week 2, Day 10]

### Task 5.1: Update mobile onboarding for Android

**File:** `waldo-app/src/screens/OnboardingScreen.tsx`

**Current:** 3 steps (Name/Timezone → Google OAuth → Telegram linking)

**Updated flow (Android):**
```
Step 1: Profile
  - Name, timezone (auto-detected from device)
  - Wearable type picker: Samsung Galaxy Watch / Fitbit / Pixel Watch / Amazfit / Xiaomi / Other / None
  - Calls user-register EF → provisions DO

Step 2: Health Connect
  - Check if Health Connect is installed (if not, link to Play Store)
  - Request permissions one type at a time with explanation:
    "Heart rate — so I can detect stress before you feel it"
    "Sleep — so I know how recovered you are"
    "Steps — so I can track your activity"
  - Run first health sync immediately after permissions granted
  - Show confirmation: "Got {N} days of data. Nice."

Step 3: Google Workspace
  - "Let me see your calendar, email, and tasks — I'll know when you're overloaded"
  - Opens OAuth in browser → returns to app
  - Skip option: "I'll set this up later"

Step 4: Spotify (optional)
  - "Music tells me a lot about your mood"
  - Opens OAuth in browser → returns to app
  - Skip option

Step 5: Telegram
  - "This is how I'll reach you"
  - Shows 6-digit linking code
  - Deep link to Telegram bot
  - On success: "Connected. I'll send my first message tomorrow morning."

Step 6: Interview handoff
  - "One more thing — I have a few questions to learn about you."
  - Opens chat screen → Waldo begins interview (Task 2.2)
  - OR: "Let's do this over Telegram instead" → sends to Telegram
```

**Acceptance:** New Android user completes onboarding → Health Connect syncing → Google connected → Telegram linked → interview begins.

### Task 5.2: First 7 days learning mode

**What:** New users don't get Fetch Alerts (stress alerts) for 7 days. Instead, they get educational Morning Wags.

**File:** `cloudflare/waldo-worker/src/agent.ts` — modify `runPatrol()`

**Logic:**
```typescript
const daysOfData = parseInt(readMemory(this.sql, 'days_of_data') ?? '0');
const baselinesEstablished = readMemory(this.sql, 'baselines_established') === 'true';

// During learning period (first 7 days):
if (daysOfData < 7 || !baselinesEstablished) {
  // Only send Morning Wag (educational, learning)
  // NO Fetch Alerts
  // NO Evening Reviews (until day 3)
  // Morning Wag content: "Day {N}. Here's what I'm learning about you..."
}
```

**Update `days_of_data` counter:** Each time new health data arrives (via check-triggers or direct sync), check if there's a new date's data and increment.

**Acceptance:** New user gets educational Morning Wags for 7 days, no Fetch Alerts until baselines established.

---

## Phase 6: Integration Testing [Week 3, Days 11-12]

### Task 6.1: Self-test (Shivansh as User 1)

**Manual process:**
1. Install APK on your Android phone
2. Complete onboarding (Health Connect + Google + Spotify + Telegram)
3. Verify in web console: user appears, health data syncing
4. Verify Telegram: Morning Wag arrives at wake time
5. Verify chat: message Waldo via Telegram, get intelligent response
6. Check DO status: `curl https://waldo-agent.YOUR.workers.dev/status/:userId`
7. Run for 24-48 hours before inviting friends

### Task 6.2: Fix issues found during self-test

**Expected issues (from audit):**
- Health Connect permission edge cases on specific OEMs
- Op-sqlite encryption key derivation on fresh install
- Supabase sync timing (first sync may be slow)
- DO alarm timing (timezone edge cases)
- Telegram delivery failures (rate limiting)

### Task 6.3: Onboard 4 friends

**Per user:**
1. Send APK via WhatsApp/Telegram/Drive
2. They install + complete onboarding
3. Verify in web console admin: user appears, data flowing
4. DO provisioned: `curl /status/:userId`
5. Wait for first Morning Wag

**Recommended cheap smartwatches for friends:**
| Watch | Price | HR | HRV | Sleep | Steps | Best For |
|-------|-------|-----|-----|-------|-------|----------|
| Fitbit Charge 5/6 | $40-70 used | Yes | Yes (RMSSD) | Yes | Yes | Full CRS |
| Xiaomi Mi Band 8/9 | $25-35 | Yes | No | Yes | Yes | Budget option |
| Amazfit Band 7 | $25-35 | Yes | No | Yes | Yes | Budget option |
| Samsung Galaxy Watch 4+ | $50-100 used | Yes | No (to HC) | Yes | Yes | If they already have one |
| Pixel Watch 2/3 | $80-120 used | Yes | Yes | Yes | Yes | Full CRS + Google Fit |

---

## User Action Items Checklist

Things only Shivansh can do (not automatable by Claude):

### Credentials to Set (30 min total)
- [ ] Set `ADMIN_API_KEY` in Supabase secrets (generate random string)
- [ ] Create Google Cloud OAuth credentials + enable Calendar/Gmail/Tasks/Fitness APIs
- [ ] Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Supabase secrets
- [ ] Set `OAUTH_REDIRECT_SUCCESS_URL=https://waldo-sigma.vercel.app` in Supabase secrets
- [ ] Create Spotify developer app at developer.spotify.com
- [ ] Set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in Supabase secrets
- [ ] Create Cloudflare account (free) if not already
- [ ] Run `wrangler deploy` from `cloudflare/waldo-worker/`
- [ ] Set Cloudflare Worker secrets (ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, WALDO_WORKER_SECRET)
- [ ] Set `CLOUDFLARE_WORKER_URL` and `WALDO_WORKER_SECRET` in Supabase secrets
- [ ] Rotate Supabase anon key (after all clients updated)

### Hardware
- [ ] Ensure you have an Android phone for testing
- [ ] Ensure at least 1 friend has a Fitbit or Pixel Watch (for full HRV CRS demo)
- [ ] Share APK with 4 friends

### Accounts
- [ ] EAS account (free, `npx eas login`)
- [ ] Cloudflare account (free)
- [ ] Google Cloud project (free tier)
- [ ] Spotify developer account (free)

---

## What NOT to Build (Deferred)

| Feature | Why Not Now | When |
|---------|-----------|------|
| WhatsApp bot | Needs Meta business verification, Telegram works fine | After beta |
| Skill creation / learning | Complex, requires weeks. Pre-defined skills sufficient. | Phase G |
| R2 archival / weekly compaction | 5 users won't fill SQLite | Phase G |
| Multi-model routing (DeepSeek) | Haiku only for simplicity | Phase 2 |
| iOS native app | Need $99 Apple Developer account | When funded |
| Watch companion apps | No Apple Dev account, Wear OS is complex | Phase 2 |
| Full 25-field prompt builder | 10 fields sufficient for beta | Phase D-E enhancement |
| Tests | Important but not blocking beta launch | Continuous during Phase G |
| Voice interface | Phase 3 | After beta |
| In-app chat (mobile) | Telegram is the channel for now | Phase F |

---

## Success Criteria

After completing this plan, the following should be true:

1. **5 users with their own Waldo** — Each has a Cloudflare DO, their own memory, their own schedule
2. **Health data flowing** — At least 3 users have smartwatch data syncing via Health Connect
3. **Google connected** — At least 4 users have Calendar + Gmail + Tasks
4. **Spotify connected** — At least 2 users
5. **Morning Wag daily** — Each user gets a personalized Morning Wag via Telegram at their wake time
6. **Fetch Alerts** — After 7-day learning period, users with low CRS get proactive alerts
7. **Chat works** — Users can message Waldo via Telegram and get health-context-aware responses
8. **Interview complete** — Each user's Waldo has a calibrated personality from the initial interview
9. **Web console** — Admin can see all 5 users, their data, their agent logs
10. **Cost under control** — Daily cost cap enforced at $0.10/user/day

---

## Execution Order Summary

```
Day 1:  Phase 0 (cleanup) + Phase 4 Tasks 4.1-4.3 (set credentials)
Day 2:  Phase 1 Tasks 1.1-1.2 (Health Connect adapter + dynamic CRS)
Day 3:  Phase 1 Tasks 1.3-1.4 (location + pipeline wiring)
Day 4:  Phase 2 Tasks 2.1-2.2 (deploy DO + interview mode)
Day 5:  Phase 2 Tasks 2.3-2.4 (wire EFs to DO + cost cap) + Phase 1 Task 1.5 (EAS build)
Day 6:  Phase 3 (web console onboarding for iOS users)
Day 7:  Phase 4 Tasks 4.4-4.5 (Google Fit + weather context) + Phase 5 (mobile onboarding)
Day 8:  Phase 5 Task 5.2 (learning mode) + integration test prep
Day 9:  Phase 6 Task 6.1 (self-test — run for 24h)
Day 10: Phase 6 Task 6.2 (fix issues)
Day 11-14: Phase 6 Task 6.3 (onboard 4 friends, monitor, fix)
```

---

## Files Changed Summary (for context loading)

**New files to create:**
- `waldo-app/modules/health-connect/HealthConnectModule.kt`
- `waldo-app/modules/health-connect/HealthConnectModule.ts`
- `waldo-app/src/adapters/health/health-connect-adapter.ts`
- `waldo-app/src/adapters/location/location-adapter.ts`
- `waldo-app/src/services/location-service.ts`
- `supabase/migrations/YYYYMMDD_location_weather.sql`

**Files to modify:**
- `waldo-app/src/crs/engine.ts` (dynamic weights)
- `waldo-app/src/services/health-pipeline.ts` (Android path)
- `waldo-app/src/screens/OnboardingScreen.tsx` (Android onboarding)
- `waldo-app/app.json` (Android permissions)
- `cloudflare/waldo-worker/src/agent.ts` (interview mode, cost cap, admin key fix)
- `cloudflare/waldo-worker/src/supabase.ts` (weather context)
- `supabase/functions/check-triggers/index.ts` (route to DO)
- `supabase/functions/telegram-bot/index.ts` (route to DO)
- `supabase/functions/user-register/index.ts` (provision DO)
- `supabase/functions/_shared/config.ts` (worker URL)
- `tools/waldo-demo/src/components/` (web onboarding)
- `.gitignore` (add entries)

**Files to delete:**
- `/agent-runtime/` (entire directory)
- `/memory/` (root level, entire directory)
- `supabase/functions/sync-youtube-music/` (entire directory)
