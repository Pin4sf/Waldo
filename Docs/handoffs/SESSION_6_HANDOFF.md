# Session 6 → Session 7 Handoff

**Date:** 2026-04-01  
**Phase:** B-TEAM (5-person internal demo build)  
**Status:** Google Workspace integrations deployed. HealthKit wiring + onboarding pending.

---

## What Was Built This Session

### 1. Security + Deployment Fixes
- Fixed `20260402000002_additional_pg_cron.sql` — removed `current_setting('app.service_role_key')` call (was failing with null constraint). pg_cron uses anon key (Edge Functions authenticate internally with service_role env var).
- Fixed `20260403000001_security_fixes.sql` — removed service_role vault logic. Now just: drop stale policy, fix `patterns.confidence` TEXT→REAL, add index.
- All 5 pending migrations deployed successfully.

### 2. All 5 New Edge Functions Deployed
- `user-profile` — create users, return linking codes, get profile
- `health-import` — bulk import pre-parsed health JSON
- `baseline-updater` — nightly baselines computation
- `weekly-compaction` — Sunday intelligence compaction
- `check-triggers` — rewritten with concurrent processing + daily Fetch Alert cap

### 3. Google Workspace Integration Stack (full)
**Migration: `20260403000002_oauth_tokens.sql`**
- `oauth_tokens` table (user_id, provider, access_token, refresh_token, expires_at, scopes[])
- `sync_log` table (per-provider sync status + last successful sync)
- pg_cron: Calendar sync every 30min, Gmail + Tasks nightly 3:30/3:45 AM UTC

**New Edge Functions (all deployed):**
- `oauth-google` — Full OAuth 2.0 flow for Google Workspace
  - GET `/connect?user_id=<id>&scopes=calendar,gmail,tasks` → redirects to Google consent
  - GET `/callback?code=...&state=...` → exchanges code, stores tokens
  - GET `/status?user_id=<id>` → connected status + sync logs
  - DELETE `/disconnect?user_id=<id>` → revoke + cleanup
- `sync-google-calendar` — Pulls Google Calendar events (yesterday + next 7 days)
  - Computes: Meeting Load Score, back-to-back count, focus gaps, boundary violations
  - Writes: `calendar_events` + `calendar_metrics`
- `sync-gmail` — Gmail metadata ONLY (volume, after-hours ratio). Never reads body/subject/sender.
  - Writes: `email_metrics`
- `sync-tasks` — Google Tasks (pile-up, velocity, urgency queue for today/tomorrow)
  - Writes: `task_metrics`

**Shared helper: `_shared/google-auth.ts`**
- `getValidGoogleToken()` — returns valid access token, auto-refreshes if expired
- `recordSync()` — updates sync_log after each sync attempt
- `googleFetch()` — standardized Google API call with 401 detection

---

## Architecture Decisions This Session

1. **Service_role key stays in env var, not vault** — `current_setting('app.service_role_key')` returns null during migration execution. pg_cron calls use anon key; Edge Functions authenticate internally.

2. **OAuth callback URL pattern** — `https://<project>.supabase.co/functions/v1/oauth-google/callback`. Must be registered as Authorized Redirect URI in Google Cloud Console.

3. **Google scopes chosen**:
   - `calendar.readonly` — read events only
   - `gmail.metadata` — subject/body never accessible with this scope
   - `tasks.readonly`
   - All request `access_type=offline` + `prompt=consent` to get refresh tokens

4. **Gmail privacy** — Only fetching `internalDate` and `labelIds` fields. No subject, no sender, no body. Batch size capped at 200 messages per sync to stay in timeout.

5. **Calendar event titles** — Stored in `calendar_events.summary` (truncated to 200 chars). Treated as PII — never logged, never included verbatim in Claude prompts. Agent uses `calendar_metrics` (scores/counts) not individual event titles.

---

## Required Setup Before Google OAuth Works

### Google Cloud Console (done once, then shared for all 5 users)
1. Create project at console.cloud.google.com
2. Enable APIs: Google Calendar API, Gmail API, Tasks API
3. OAuth consent screen → External → add scopes (calendar.readonly, gmail.metadata, tasks.readonly)
4. Create OAuth 2.0 credentials (Web application)
5. Add Authorized redirect URI: `https://ogjgbudoedwxebxfgxpa.supabase.co/functions/v1/oauth-google/callback`
6. Add success redirect URI to env

### Set Supabase Edge Function secrets (Dashboard → Edge Functions → Secrets)
```
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
OAUTH_REDIRECT_SUCCESS_URL=<app deep link or web page URL>
```

### How each teammate connects Google
```
GET https://ogjgbudoedwxebxfgxpa.supabase.co/functions/v1/oauth-google/connect?user_id=<their_user_id>&scopes=calendar,gmail,tasks
```
Opens in browser → Google consent → callback → tokens stored → syncs start immediately.

---

## What Still Needs Building

### P0 — Blocks all 5 users getting started
**Onboarding flow** (not yet built)
- Users need a way to sign up and get a `user_id` before they can connect Google
- Options:
  a. Add auth screens to waldo-app (Phase F work, 3-4 days)
  b. Admin creates users manually in Supabase dashboard + shares user_id (works for 5 people)
  c. Build minimal web onboarding page (Next.js, 1 day)
- Recommendation: option b for NOW (get 5 people running this week), then build properly

**Telegram onboarding bot** (not yet built)
- `/start` should walk new users through: name → timezone → wake time → "Export your Apple Health"
- Currently `/start` just gives a linking code with no profile setup

### P1 — Health data (the core of Waldo)
**HealthKit live wiring** (iOS, task #11)
- Native module already built at `modules/healthkit/src/HealthKitModule.ts`
- Needs to be wired into `src/services/health-pipeline.ts`
- Auto-sync on app foreground + BGTaskScheduler background task

**Health Connect (Android, task #12)**
- Not yet started
- Kotlin module using Expo Modules API + Health Connect API
- Until this is built, Android users need Apple Health XML export workaround (N/A for them)
- Workaround for non-iPhone users: Google Fit export → parser (limited data)

### P2 — Quality gaps
**invoke-agent hardening (task #14)**
- Add Zod at request boundary
- Add AbortController (40s) on Anthropic call
- Remove 29 `any` types

**Microsoft/Outlook integration** (if any team member uses it)
- Same pattern as Google — `oauth-microsoft` function + `sync-outlook-calendar` + `sync-outlook-email`
- Uses Microsoft Graph API
- ~2 days if needed

---

## Current Edge Functions (13 total, all deployed)

| Function | Trigger | Purpose |
|---|---|---|
| `telegram-bot` | Webhook | Message routing, feedback, linking |
| `check-triggers` | pg_cron 15min | Morning Wag + Fetch Alert + Evening Review |
| `invoke-agent` | HTTP | Claude agent with tools |
| `user-profile` | HTTP | User registration + linking codes |
| `health-import` | HTTP | Bulk health data import |
| `baseline-updater` | pg_cron 4am | Nightly baselines |
| `weekly-compaction` | pg_cron Sun 8pm | Intelligence compaction |
| `oauth-google` | HTTP | Google OAuth connect/callback |
| `sync-google-calendar` | pg_cron 30min | Calendar events + metrics |
| `sync-gmail` | pg_cron 3:30am | Email volume metrics |
| `sync-tasks` | pg_cron 3:45am | Task pile-up + velocity |

---

## Migrations Applied (7 total)

```
20260331000001_waldo_demo_schema.sql          ✅ (original schema, 22 tables)
20260331000002_pg_cron_triggers.sql           ✅ (original cron — anon key in here, rotate!)
20260331000003_fix_rls_for_demo.sql           ✅
20260401000001_add_platform_fields.sql        ✅
20260402000001_multi_user_auth.sql            ✅ (auth_id, linking_codes, sent_messages)
20260402000002_additional_pg_cron.sql         ✅ (baseline-updater, weekly-compaction, etc.)
20260403000001_security_fixes.sql             ✅ (drop allow_all_users, patterns.confidence fix)
20260403000002_oauth_tokens.sql               ✅ (oauth_tokens, sync_log, 3 new cron jobs)
```

**CRITICAL: Rotate the anon key** — it's committed in `20260331000002_pg_cron_triggers.sql:11`.
Update vault via Supabase dashboard after rotation.

---

## Hard-Won Lessons This Session

1. `current_setting('app.service_role_key')` returns null during migration execution — never use it in migrations
2. Partial index predicates (`WHERE expires_at < now()`) fail because `now()` is STABLE, not IMMUTABLE — use plain index on the column
3. pg_cron jobs don't need service_role key in vault — they call endpoints, and the endpoints themselves authenticate internally
4. Gmail API: only `internalDate` + `labelIds` fields are safe to fetch with metadata scope — other fields require full message scope

---

## Quickstart for Getting All 5 Users Running

```bash
# 1. Rotate Supabase anon key in dashboard (Settings → API → Regenerate)
#    Then update vault: run in SQL editor:
#    SELECT vault.create_secret('<new_anon_key>', 'waldo_anon_key_rotated');

# 2. Set Google OAuth secrets in Supabase dashboard:
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_REDIRECT_SUCCESS_URL=https://your-app.com/connected

# 3. For each of the 5 users:
#    a. Create user manually in Supabase dashboard (users table)
#    b. Run seed-supabase.ts with their Apple Health export:
SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx tools/health-parser/src/seed-supabase.ts <path/to/export.xml>
#    c. Send them this URL to connect Google:
https://ogjgbudoedwxebxfgxpa.supabase.co/functions/v1/oauth-google/connect?user_id=<their_user_id>&scopes=calendar,gmail,tasks
#    d. DM @YourWaldoBot on Telegram, send their 6-digit linking code

# 4. After first Google sync (triggers automatically after OAuth):
#    Morning Wags will start firing at each user's wake time
```

---

## Next Session Priority

1. **HealthKit live wiring** — wire `modules/healthkit/` into `health-pipeline.ts`
2. **Telegram onboarding bot** — guided `/start` flow with profile setup
3. **invoke-agent hardening** — Zod + AbortController
4. **Get all 5 users seeded** — manual for now, automated later
5. **Microsoft Outlook** — only if someone on the team uses it
