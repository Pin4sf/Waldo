# Session 5 → Session 6 Handoff

**Date:** 2026-04-02
**Phase:** B-INFRA (multi-user foundation on Supabase)
**Status:** Infrastructure complete. Agent is intelligent. Not yet deployed for real users.

---

## What Was Built This Session

### 1. Complete Agent Workspace (`agent/` directory)
37 files across 12 directories. This is Waldo's brain — spec'd and ready.

**Platform-level (Ring 1 — immutable):**
- `agent/identity/` — IDENTITY.md, PRINCIPLES.md
- `agent/soul/` — SOUL_BASE, SOUL_MORNING, SOUL_STRESS, SOUL_CHAT, SOUL_EVENING, SOUL_DEPLETED, SOUL_PEAK, SOUL_FIRST_WEEK, FALLBACK_TEMPLATES.md
- `agent/rules/` — SAFETY.md, TOOLS_PERMISSIONS.md, SECURITY.md, MEDICAL_DISCLAIMERS.md
- `agent/heartbeat/` — HEARTBEAT_MORNING, HEARTBEAT_PATROL, HEARTBEAT_EVENING, HEARTBEAT_BASELINE, HEARTBEAT_WEEKLY
- `agent/operators/` — OPERATOR_CONSUMER.md, OPERATOR_NFL.md
- `agent/onboarding/` — INTERVIEW_SCRIPT.md, INTERVIEW_SCHEMA.md
- `agent/skills/` — SKILLS_BUILTIN.md, SKILLS_MANIFEST.md
- `agent/BOOTSTRAP.md` — cold-start spec for new users
- `agent/PROMPT_BUILDER.md` — exact prompt assembly spec (11 sections, token budgets)

**Per-user (Ark's workspace — Ring 2+3):**
- `agent/users/ark/memory/` — MEMORY_CORE, MEMORY_PATTERNS, MEMORY_GOALS, MEMORY_FOLLOWUPS
- `agent/users/ark/calibration/` — CALIBRATION_VERBOSITY (BRIEF), CALIBRATION_TIMING, CALIBRATION_TOPICS
- `agent/users/ark/skills/SKILLS_USER.md` — empty (no user skills yet)
- `agent/users/ark/evolution/EVOLUTION_LOG.md` — baseline values, no evolutions yet
- `agent/users/ark/heartbeat/HEARTBEAT_USER.md` — Ark-specific schedule overrides

### 2. Multi-User Infrastructure

**New migrations:**
- `supabase/migrations/20260402000001_multi_user_auth.sql`
  - `auth_id` column on users (links to Supabase Auth)
  - `telegram_linking_codes` table (6-digit, 10-min expiry)
  - `sent_messages` table (idempotency)
  - Replaced anon demo RLS with proper `auth.uid()` policies
  - `waldo_user_id()` helper function for RLS
- `supabase/migrations/20260402000002_additional_pg_cron.sql`
  - `waldo-baseline-updater` → 4 AM UTC daily
  - `waldo-weekly-compaction` → Sunday 20:00 UTC
  - `waldo-daily-cost-reset` → midnight UTC
  - `waldo-expire-linking-codes` → hourly
  - `waldo-cleanup-sent-messages` → 3 AM UTC daily

**Updated Edge Functions:**
- `_shared/config.ts` — removed DEMO_USER_ID, added `getUserByChatId()`, `createLinkingCode()`, `checkIdempotency()`, `recordSent()`
- `_shared/soul-file.ts` — added `evening_review` and `onboarding` to MessageMode + templates
- `_shared/fallback-templates.ts` — NEW: pre-filter template library (morning_wag × zone, evening_review × zone, fetch_alert × signal type, data_sparse for new users)
- `telegram-bot/index.ts` — multi-user: chat_id lookup, 6-digit linking flow, onboarding routing, user-scoped feedback
- `check-triggers/index.ts` — multi-user loop: all active users, timezone-aware time check, idempotency, evening_review trigger
- `invoke-agent/index.ts` — requires user_id, cost circuit breaker ($0.10/day), **pre-filter rules engine** (skips Claude 60-80% of triggers), **evolution processor** (loads pending calibration changes into prompt), **MEMORY_CORE injection** (core_memory table loaded into every prompt), prompt injection defense (wraps user messages)

---

## Current Architecture State

```
Supabase (deployed, running for Ark)
  ├── 17 health/productivity tables + 3 new tables (linking_codes, sent_messages + auth)
  ├── 5 Edge Functions (telegram-bot, check-triggers, invoke-agent + 2 shared)
  ├── pg_cron: 15-min check-triggers + 5 new scheduled jobs (NOT YET DEPLOYED)
  └── RLS: proper auth-scoped policies (NOT YET DEPLOYED — migration pending)

agent/ workspace (spec files, not yet Edge Function runtime)
  └── All content is reference/spec. Runtime implementations are in Edge Functions.
      Phase D: these move into Cloudflare DO SQLite as structured records.
```

**NOT YET DEPLOYED (user must run):**
```bash
supabase db push           # Apply the 2 new migrations
supabase functions deploy telegram-bot
supabase functions deploy check-triggers
supabase functions deploy invoke-agent
```

**Supabase Auth must be enabled in dashboard:**
- Authentication → Providers → Email → enable "Magic link"

---

## What Still Needs Building (Backend — no native modules needed)

### P0 — Unblocks first real users

**`user-profile` Edge Function** (2h)
The app needs to create user records and return a linking code. Right now there's no endpoint for this.
```
POST /user-profile
  body: { auth_id, name, timezone, wearable_type }
  → creates users row
  → generates 6-digit linking code
  → returns { user_id, linking_code }

GET /user-profile
  → returns user profile + onboarding status
```

**`health-import` Edge Function** (6h)
Bridge for real users before HealthKit is built. Accepts Apple Health XML ZIP, runs the existing parser (tools/health-parser/), populates all tables.
```
POST /health-import
  body: multipart form with zip file
  → streams XML parse (use tools/health-parser/src/xml-stream-parser.ts)
  → populates: health_snapshots, crs_scores, stress_events, spots, patterns, day_activity
  → returns { days_imported, crs_range, patterns_found }
```
Key challenge: 50s Edge Function timeout. Limit to last 90 days per import. Stream-parse (existing parser already does this).

### P1 — Intelligence grows over time

**`baseline-updater` Edge Function** (3h)
Runs at 4 AM UTC (pg_cron already scheduled — just needs the function).
No LLM. Computes:
- HRV EMA (14-day weighted)
- Sleep duration 7-day rolling average
- Resting HR 30-day average
- Sleep debt accumulation
- Days-of-data count (used by pre-filter for new user detection)
Writes to `core_memory` table: `{ key: 'hrv_baseline', value: '64ms' }` etc.
Reference: `agent/heartbeat/HEARTBEAT_BASELINE.md`

**`weekly-compaction` Edge Function** (4h)
Runs Sunday 20:00 UTC (pg_cron already scheduled — just needs the function).
Steps:
1. Read last 7 days of conversation_history for this user
2. Read patterns table — update confidence/evidence counts
3. Promote emerging patterns if confidence > 0.70 (change `tier` field)
4. Regenerate user_intelligence summary from core_memory + patterns
5. Write back to user_intelligence and patterns tables
Reference: `agent/heartbeat/HEARTBEAT_WEEKLY.md`

**`user-profile` Edge Function also needs:**
- `GET /user-profile/linking-code` → generate new linking code (if expired)

### P2 — Polish

**App auth screens (React Native)**
- Sign up / sign in screens (Supabase Auth magic link)
- "Link Telegram" screen that shows the 6-digit code
- These call the `user-profile` Edge Function

**Evolution signal application** (already half-done)
- Evolution records written on 👍/👎 (done)
- Pending evolutions merged into prompts (done in this session)
- Missing: mark evolutions as `applied = true` after they've been used in 3+ prompts

---

## Architecture Decisions Made This Session

1. **Supabase-first, Cloudflare DOs later** — Do NOT build DOs until 100+ users. The delta from demo to multi-user was ~45h of Edge Function work, not 3 weeks of DO architecture.

2. **Pre-filter skips Claude for 60-80% of triggers** — CRS > 60 + stress_confidence < 0.30 → template. Implemented in invoke-agent via `runPreFilter()` in `_shared/fallback-templates.ts`.

3. **MEMORY_CORE injected into every Claude call** — `core_memory` table rows loaded and appended to user context. This is what makes Claude responses personalized to this specific user.

4. **Cost circuit breaker at $0.10/user/day** — Prevents runaway costs from prompt injection or chatty users. Resets daily via pg_cron.

5. **Prompt injection defense** — User messages wrapped in `---BEGIN USER MESSAGE---` / `---END USER MESSAGE---` before reaching Claude. Added this session.

6. **Per-user linking codes** — 6-digit, 10-min expiry. Any iPhone user: export Apple Health → upload → link Telegram → Morning Wag tomorrow.

---

## Hard-Won Lessons This Session

- Two `CrsResult` types existed: `src/types/crs.ts` (UI discriminated union) vs `src/crs/types.ts` (engine type). All storage/pipeline code must use the engine type. The UI type is unused.
- `expo-modules-core` `EventEmitter` requires `EventsMap` with function signature values: `{ onHealthDataUpdated: (event: { type: string }) => void }` — NOT `{ onHealthDataUpdated: { type: string } }`.
- `op-sqlite execute()` is async — all calls must be `await`ed.
- pg_cron vault secrets: the existing migration uses `anon` key for check-triggers (deployed with `--no-verify-jwt`). New internal functions (baseline-updater, weekly-compaction) need `service_role` key — store separately in vault.

---

## What Phase D Looks Like (Don't Build Yet)

When hit 100+ users or need per-user scheduling / WebSocket:

```
Each user gets a Cloudflare Durable Object (their persistent Waldo)
  └── DO SQLite tables:
      memory_blocks   (replaces core_memory in Supabase)
      episodes        (conversation summaries)
      user_prefs      (replaces preferences in Supabase)
      agent_evolutions (replaces agent_evolutions in Supabase)
      sent_messages   (replaces sent_messages in Supabase)

  DO alarms (replace pg_cron):
      Morning Wag → alarm at user.wake_time
      Evening Review → alarm at user.preferred_evening_time
      Patrol → alarm every 15 min while active
      Baseline update → alarm at 4 AM user local time
      Weekly compaction → alarm at Sunday 20:00 user local time
```

Health data STAYS in Supabase. DO reads it via REST when it wakes up.
Migration: add `do_initialized` flag to users table, migrate memory in batches.

---

## Files Changed This Session

**New migrations:**
- `supabase/migrations/20260402000001_multi_user_auth.sql`
- `supabase/migrations/20260402000002_additional_pg_cron.sql`

**Modified Edge Functions:**
- `supabase/functions/_shared/config.ts`
- `supabase/functions/_shared/soul-file.ts`
- `supabase/functions/_shared/fallback-templates.ts` (NEW)
- `supabase/functions/telegram-bot/index.ts`
- `supabase/functions/check-triggers/index.ts`
- `supabase/functions/invoke-agent/index.ts`

**New agent workspace files (37 total — all in `agent/`):**
- `agent/BOOTSTRAP.md`, `agent/PROMPT_BUILDER.md`
- `agent/identity/IDENTITY.md`, `agent/identity/PRINCIPLES.md`
- `agent/soul/SOUL_*.md` (8 files), `agent/soul/FALLBACK_TEMPLATES.md`
- `agent/rules/SAFETY.md`, `SECURITY.md`, `TOOLS_PERMISSIONS.md`, `MEDICAL_DISCLAIMERS.md`
- `agent/heartbeat/HEARTBEAT_*.md` (5 files)
- `agent/operators/OPERATOR_CONSUMER.md`, `OPERATOR_NFL.md`
- `agent/onboarding/INTERVIEW_SCRIPT.md`, `INTERVIEW_SCHEMA.md`
- `agent/skills/SKILLS_BUILTIN.md`, `SKILLS_MANIFEST.md`
- `agent/users/ark/` (full workspace — memory, calibration, skills, evolution, heartbeat)
- `agent/README.md` (updated)

**Modified waldo-app (TypeScript fixes from session start):**
- `src/types/adapters.ts` — CrsResult import fix
- `src/adapters/storage/opsqlite.ts` — await runMigrations, CrsResult import fix
- `modules/healthkit/src/HealthKitModule.ts` — EventEmitter<HealthKitEventMap>, EventSubscription

**New docs:**
- `Docs/WALDO_DESIGNER_BRIEF.md` — complete rewrite (v2.0)
- `Docs/handoffs/SESSION_5_HANDOFF.md` — this file

---

## Codebase Audit Results (End of Session 5)

Full audit run at end of session. Honest ratings, no softening.

| Area | Rating | Verdict |
|------|--------|---------|
| TypeScript Quality | 3/5 | 20+ `any` in invoke-agent; no Zod at Edge Function request boundaries |
| Edge Functions | 3/5 | No timeout guards; anon key public; force_trigger unvalidated; no daily Fetch Alert cap |
| Database Schema | 3/5 | Anon JWT in git; `allow_all_users` policy too broad; `patterns.confidence` is TEXT not REAL |
| React Native App | 3/5 | No error boundary; TanStack Query unused; pipeline init not guaranteed; two CRS copies will diverge |
| CRS Engine | 4/5 | Math is correct and validated. `peakHour` dead variable; circadian doesn't account for time-since-wake |
| Security | 3/5 | Real anon key in git migration; DEMO_USER_ID not removed from prod migrations; canary token not implemented; no safeFetch |
| Naming Conventions | 4/5 | Three zone taxonomies (`PersonalityZone` / `CrsZone` / `FallbackZone`); `opsqlite.ts` not kebab-case |
| Architecture | 4/5 | Two CRS engine copies already diverging; pipeline-provider uses module-level singleton; supabase-client directly imported in sync queue |
| Agent Workspace | 3/5 | PROMPT_BUILDER.md ~80% unimplemented; HEARTBEAT files diverge from check-triggers; soul strings diverge from soul files |

**Overall: 3.3/5 — Solid foundation, real gaps before real users.**

---

### Critical — Fix before first real user

**1. Anon JWT committed in git** (`supabase/migrations/20260331000002_pg_cron_triggers.sql:11`)
The real project anon key (`eyJhbGciOiJIUzI1NiIsInR5cCI6...`) is in plaintext in a migration file committed to git. Project reference (`ogjgbudoedwxebxfgxpa`) also exposed. Even if rotated, it's in git history.
Fix: rotate the key in Supabase dashboard → store new key in vault via a separate `vault.create_secret` call outside of committed migration files → reference via vault name only.

**2. Anyone can trigger Waldo for any user** (`check-triggers/index.ts:132`)
No auth check on the Edge Function. Anon key (now public) is enough to call it. `force_trigger` is an unvalidated string — any value passes through to invoke-agent.
Fix: validate `force_trigger` against `MessageMode` enum values. Require service_role key on `check-triggers` (not anon). Move pg_cron to use service_role key from vault.

**3. `allow_all_users` RLS policy still active**
Migration 1 (`20260331000001`) creates `allow_all_users ON users TO authenticated USING (true)` — any authenticated user can read any other user's row. Migration 4 adds scoped policies but does NOT drop this old one.
Fix: add `DROP POLICY IF EXISTS "allow_all_users" ON users;` at the top of the next migration.

---

### Significant — Fix in next sprint

**4. Sequential user loop breaks at ~10 users**
`check-triggers` processes users in a `for` loop (~3-8s per user). At 10 users = 30-80s, which hits the 50s Edge Function timeout. Users 8-10 never get their Morning Wag.
Fix: `Promise.allSettled` with concurrency limit of 5.

**5. No timeout guard on Anthropic API calls**
If Claude's API hangs, the Edge Function hangs until Supabase's 150s hard kill. No `AbortController` anywhere in the ReAct loop.
Fix: wrap Anthropic call with `AbortController` at 40s, fall back to template at Level 3.

**6. PROMPT_BUILDER.md is ~80% unimplemented**
`assembleSoulPrompt()` in `soul-file.ts` builds 3 sections (SOUL_BASE + zone modifier + mode template). The spec defines 11 sections including operator config, structured biometrics block, calibration context, on-demand memory, trigger payload, and sandwich defense. The invoke-agent handles some of this via `buildNarrativeContext` but it's not following the spec layout.
Fix: refactor `assembleSoulPrompt()` to accept user context and build the full prompt per the PROMPT_BUILDER spec.

**7. Daily Fetch Alert cap missing**
`HEARTBEAT_PATROL.md` specifies max 3 Fetch Alerts per day per user. Not implemented. Idempotency only enforces 2-hour cooldown — it doesn't count daily sends.
Fix: add a daily count check in `check-triggers`: query `sent_messages WHERE trigger_type = 'fetch_alert' AND date = today` and skip if count ≥ 3.

**8. Three zone naming schemes**
- `PersonalityZone` in `soul-file.ts`: `energized/steady/flagging/depleted/crisis`
- `CrsZone` in `crs/types.ts`: `peak/moderate/low`
- `FallbackZone` in `fallback-templates.ts`: `peak/steady/flagging/depleted/no_data`

These are cast between with `as FallbackZone` — works by coincidence. If either type changes, it silently breaks. Needs one canonical zone type, ideally in `crs/types.ts` since that's where zone computation lives.

**9. No Zod at Edge Function request boundaries**
`invoke-agent` consumes `body.user_id`, `body.trigger_type`, `body.question` directly from `req.json()` with no schema validation. Invalid payloads fail deep inside tool execution with confusing errors.
Fix: define a Zod schema for the request body at the top of each Edge Function handler. Use `safeParse` and return 400 on failure.

**10. 20+ `any` types in invoke-agent**
`executeTool(name: string, input: any, ..., supabase: any)` — the entire tool execution layer is untyped. Every Supabase result iterated with `(d: any) =>`. Not a runtime problem today but makes safe refactoring impossible.

---

### Minor — Good to fix, not blocking

- **`peakHour` dead variable** in `crs-engine.ts` — computed, never used. Delete it.
- **Two CRS engine copies** (`tools/health-parser/src/` and `waldo-app/src/crs/`) are already diverging (app version doesn't include HRV in `buildSummary`). Need a shared package eventually.
- **TanStack Query installed but not used anywhere** — pure unused bundle weight. Remove until Phase D.
- **No React error boundary** — any render error crashes the entire app. Wrap `app/_layout.tsx` with an `<ErrorBoundary>`.
- **`activitySummary` and `exerciseMinutes` hardcoded `null`/`0`** in aggregator for Phase B1. The strain and exercise scoring paths in CRS engine are dead code until Phase C.
- **`opsqlite.ts` should be `op-sqlite.ts`** — inconsistent with kebab-case convention.
- **Canary token check not implemented** — `SECURITY.md` defines `WALDO_CANARY_7a3f` but it's not in the system prompt and not checked in output validation.
- **`safeFetch` egress allowlist not implemented** — `SECURITY.md` specifies it. No outbound fetch control exists.
- **`patterns.confidence` is `TEXT NOT NULL`** in schema but used as a float in code — type mismatch between DB and application layer.

---

### What Is Actually Production-Quality

- **CRS algorithm** — math correct, validated on 856 days, null-safe, weight redistribution works.
- **HealthKit native module** — Zod at every native boundary, IBI→RMSSD path correct, cross-midnight sleep handling correct.
- **StorageAdapter** — SQLCipher, Keychain key derivation, parameterized queries, corruption recovery.
- **Hexagonal architecture in app** — genuine. No direct Supabase calls in components.
- **Prompt injection defense** — sandwich wrapper exists in the right position.
- **Medical disclaimer logic** — well-specified, emergency bypass is unconditional.

---

## Next Session Priority

**Before writing any new code:**
1. Rotate the Supabase anon key (dashboard → API settings → regenerate)
2. Add `DROP POLICY IF EXISTS "allow_all_users" ON users` to next migration
3. Require service_role on `check-triggers` (not anon)

**Then build:**
1. **Deploy migrations + Edge Functions** — `supabase db push` + `supabase functions deploy`
2. **Build `user-profile` Edge Function** — creates users, returns linking code
3. **Build `health-import` Edge Function** — Apple Health XML bridge for beta users
4. **Build `baseline-updater` Edge Function** — 4 AM nightly compute (pg_cron already scheduled)
5. **Fix sequential loop in `check-triggers`** — `Promise.allSettled` with concurrency cap
6. **App auth screens** — sign up, link Telegram
7. Then: **Phase B1 (HealthKit native Swift module)** — real-time health data

Start next session by reading this file + `Docs/WALDO_MASTER_REFERENCE.md` Section 2.3 and `Docs/MVP_ENGINEERING_PRD.md`.
