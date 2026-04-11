# Waldo Dashboard — Backend Blockers & Intelligence Gaps

*Updated: April 12, 2026 — PR #2 (suyash-web-console-ui) analysis added*

This document tracks every place where the dashboard design outpaces the backend — data we're designing for but the backend doesn't yet serve. Updated after every implementation sprint.

---

## How to use this doc

- **Design for the full vision** — build cards, UI states, and data flows assuming full backend capability
- **Track what's missing** — when a card renders a ghost/placeholder, add the blocker here
- **Fix order** — P0 blocks launch, P1 blocks Phase 2, P2 blocks Phase 3+

---

## P0 — Blocks MVP Launch

### 1. Form component breakdown in The Brief

**Dashboard need:** The Brief card needs to show which pillar is dragging Form (CASS/Recovery/ILAS with neutral-substitution scores)

**What backend returns:** `crs.summary` string only. No pillar drag scores.

**What's needed in backend:**
- `crs.pillars.recovery`, `crs.pillars.cass`, `crs.pillars.ilas` (0–100 each)
- `crs.primaryDrag` — which pillar is most suppressed
- `crs.dragScore` — how many CRS points it's pulling down

**Edge Function to update:** `supabase/functions/invoke-agent/` or the daily CRS computation  
**Effort:** 1–2 days

---

### 2. The Patrol — WaldoActionData not populated

**Dashboard need:** The Patrol section shows a real-time timestamped log of every action Waldo took today (The Brief sent, Fetch fired, Adjustment made, suppressed alerts)

**Type already exists:** `WaldoActionData { time, action, reason, type }` in `types.ts`

**What backend returns:** `waldoActions` array is always empty `[]` — not populated

**What's needed in backend:**
- `invoke-agent` Edge Function must write each tool call + delivery to `waldo_actions` table
- `check-triggers` must log when it suppresses (cooldown, pre-filter)
- `supabase-api.ts` `fetchDay()` must include `waldoActions` in its query

**Effort:** 2–3 days

---

### 3. The Handoff — No backend endpoint

**Dashboard need:** The Handoff is the moment Waldo proposes an action ("Move your 9am to 10:30? Run it?") and the user approves or rejects inline. Biggest agentic interaction in the product.

**What exists:** Nothing. No table, no Edge Function, no types.

**What's needed in backend:**
- `waldo_proposals` table: `(id, user_id, type, description, proposed_actions JSONB, status, created_at, resolved_at)`
- `invoke-agent` must write proposals instead of acting autonomously at L2 autonomy level
- `POST /proposals/:id/approve` and `/reject` endpoints
- Webhook to execute the approved actions (calendar move, etc.)

**Effort:** 1 week

---

### 4. Circadian Score not computed

**Dashboard need:** Circadian score is one of the 4 Form components (35% weight). The Form card shows it as 0 or placeholder.

**Backend gap:** Circadian score computation is not implemented. `crs.circadian.score` is always 0 or dummy.

**What's needed:**
- `circadian_score` computation: gap between actual wake time vs chronotype-optimal wake time
- 14-day bedtime SD for consistency bonus
- Write to `health_snapshots` alongside other CRS components

**Effort:** 2 days

---

### 5. SpO2 and Wrist Temp in Form breakdown

**Dashboard need:** Form detail view should show SpO2 and wrist temperature as secondary signals (surface only if outside normal range)

**Backend gap:** Data is stored in `health_snapshots` but not surfaced in `DayResponse`

**What's needed:**
- Add `spO2: number | null` and `wristTempDeviation: number | null` to `DayResponse`
- Surface in Edge Function that builds the day response

**Effort:** 0.5 days

---

## P1 — Blocks Phase 2 (Multi-domain intelligence)

### 6. The Stack — Meeting load card

**Dashboard need:** Dedicated Stack card showing meeting load (0–15+), back-to-back count, boundary violations, focus gaps

**Backend status:** `calendar` data IS in `DayResponse` — `meetingLoadScore`, `backToBackCount`, `boundaryViolations`, `focusGaps`. ✅

**Gap:** No `meetingLoadScore` formula documented. What's the 0–15+ scale? How is it computed?

**What's needed:**
- Spec for Meeting Load Score computation (back-to-back meetings amplify exponentially)
- `focusGaps` needs quality score (how protected is each gap from adjacent meetings)

**Effort:** 1 day (spec + implementation)

---

### 7. Signal Pressure — Email/comms load card

**Dashboard need:** Signal Pressure card with volume × response pressure × after-hours ratio

**Backend status:** `email` data IS in `DayResponse` — `totalEmails`, `afterHoursRatio`, `volumeSpike`. ✅

**Gap:** No `signalPressureScore` computed. Raw counts only. Need a composite 0–100 score.

**What's needed:**
- `signalPressureScore` computation: volume × response pressure × after-hours ratio
- Define "response pressure" — ratio of received emails that got same-day replies

**Effort:** 1 day

---

### 8. Task Pile-Up card

**Dashboard need:** Overdue task count, urgency queue (due today), completion velocity trend

**Backend status:** `tasks` IS in `DayResponse` — `pendingCount`, `overdueCount`, `recentVelocity`. ✅

**Gap:** No procrastination index. No task-energy match (are heavy tasks scheduled during Form peak?).

**What's needed:**
- `procrastinationIndex` — ratio of overdue high-priority tasks
- `taskEnergyMatch` — cross-reference task due times with Form peak window

**Effort:** 2 days (needs CRS timeline + task timeline correlation)

---

### 9. The Tone — Mood inference card

**Dashboard need:** Mood inferred from Spotify valence × energy. Morning vs afternoon cluster.

**Backend status:** Spotify sync exists, audio features collected.

**Gap:** No mood score computed. `DayResponse` has no `mood` field at all.

**What's needed:**
- `mood: { score: number; valence: number; energy: number; clusterLabel: string } | null` in `DayResponse`
- Spotify sync must compute `avg_valence`, `avg_energy` per time block (morning/afternoon/evening)
- Mood score derivation: `(valence × 0.6) + (energy × 0.4)`, time-weighted

**Effort:** 2 days

---

### 10. Signal Ratio — Screen time card

**Dashboard need:** Productive hours / total hours. Late-night digital activity flag.

**Backend status:** RescueTime sync exists.

**Gap:** No `signalRatio` in `DayResponse`. Raw data may not be surfaced.

**What's needed:**
- `screenTime: { productiveHours: number; totalHours: number; signalRatio: number; lateNightMinutes: number } | null`
- RescueTime Edge Function must write to `daily_context` table

**Effort:** 1 day

---

### 11. Today's Weight — Master overload metric

**Dashboard need:** Single composite number combining all 6 dimensions. High Weight + low Form = intervention.

**Backend status:** `cognitiveLoad` exists in `DayResponse` but is partial — only meets/comms/tasks/sleep-debt.

**Gap:** `cognitiveLoad` does not include mood or signal ratio. No `todaysWeight` master metric.

**What's needed:**
- Expand `cognitiveLoad` to include `moodLoad` and `screenTimeLoad`
- Or add separate `todaysWeight: { score: number; components: {...}; delta: number }` field

**Effort:** 2 days (after P1 items 6–10 complete)

---

### 12. The Window — Focus protection

**Dashboard need:** Show the best focus block available today (≥90 min during Form peak). Waldo protects it in the calendar.

**Backend status:** `focusGaps` exists in `calendar` data.

**Gap:** No "recommended window" selection. No calendar write-back. No "Waldo protecting it" confirmation.

**What's needed:**
- `recommendedFocusWindow: { start: string; end: string; durationMinutes: number; formScore: number } | null`
- Calendar write-back API (Google Calendar `events.insert` with Waldo-created event)
- `waldo_proposals` table for approval flow before writing

**Effort:** 1 week (calendar write-back is non-trivial)

---

## P2 — Blocks Phase 3 (Constellation + long-term)

### 13. The Slope — 4-week direction chart

**Dashboard need:** Dumbbell plot showing today vs 4 weeks ago across all 6 dimensions

**Backend status:** Historical data exists. No aggregated 28-day trend endpoint.

**What's needed:**
- `GET /trend?range=28d` endpoint returning per-dimension averages for week 1 vs week 4
- Direction signal: `{ dimension, weekOne, weekFour, direction: 'improving'|'declining'|'stable' }[]`

**Effort:** 1–2 days

---

### 14. The Constellation — Force-directed graph

**Dashboard need:** Node graph of all Spots with edges showing correlations. Named patterns surface after 30+ days.

**Backend status:** `crossSourceInsights` exists. Pattern detection runs. 84 spots in R2 workspace.

**Gap:** No API to fetch all spots as a graph. No edge/correlation data. Pattern names aren't structured.

**What's needed:**
- `GET /constellation` returning `{ nodes: SpotNode[], edges: CorrelationEdge[], patterns: NamedPattern[] }`
- Pattern naming via Claude Haiku (nightly, during Patrol)
- Minimum 30-day history required before enabling

**Effort:** 2–3 days

---

### 15. Agent using ALL data (not just health)

**Dashboard need:** When user chats with Waldo, it should reference calendar load, email pressure, tasks, mood

**Backend status:** Agent CF Worker only has `get_crs`, `get_sleep`, `get_stress_events` as tools with real data. Calendar/email/task tools exist in code but return empty or minimal data.

**What's needed:**
- `get_calendar_load()` tool returning The Stack score + today's meeting schedule
- `get_task_status()` tool returning pile-up count + urgency queue
- `get_comms_pressure()` tool returning Signal Pressure score
- `get_mood()` tool returning Tone score from Spotify

**Effort:** 3–4 days

---

## Connectors Needed (Not Yet Built)

These connectors are needed for the full vision. Dashboard designs for them should use ghost tiles with "Connect X" CTAs.

| Connector | What it unlocks | Dashboard Card | Effort |
|---|---|---|---|
| Apple Calendar (native) | The Stack for iOS-only users | The Stack | 3 days |
| Outlook/Microsoft Graph | The Stack + Signal Pressure for enterprise | The Stack, Signal Pressure | 3 days |
| Slack (metadata only) | Signal Pressure including Slack messages | Signal Pressure | 2 days |
| WhatsApp (metadata) | Signal Pressure for WhatsApp-heavy users | Signal Pressure | 5 days |
| GitHub | Developer-specific task/work load | Task Pile-Up | 2 days |
| Jira | Task Pile-Up for engineering teams | Task Pile-Up | 2 days |
| Garmin | Alternative wearable source | Form (wearable-agnostic) | 1 week |
| Oura | Best sleep staging alternative | Sleep card | 3 days |
| WHOOP | Day Strain integration | Load card | 3 days |
| Fitbit/Pixel Watch | Android alternative to Apple Watch | Form | 1 week |
| Apple Health (live) | Live HealthKit queries (vs XML upload) | All health cards | Phase B1 |
| Health Connect (Android) | Android live health data | All health cards | Phase B2 |

---

## Dashboard Ghost Tile Copy (for unconnected sources)

When a Phase 2 card has no data, show an invitation not an error:

```
The Stack — "Waldo can't see your meeting load. Connect Calendar and The Stack comes alive."
Signal Pressure — "Your comms noise isn't visible yet. Connect Gmail or Slack to surface Signal Pressure."
Task Pile-Up — "Connect Todoist, Linear, or Notion to see your Task Pile-Up."
The Tone — "Connect Spotify and Waldo reads the room by reading your playlist."
Signal Ratio — "Connect RescueTime to see your Signal Ratio."
The Window — "Needs Calendar connected to find and protect your focus block."
Today's Weight — "Needs 3+ sources to compute your full weight."
The Slope — "Needs 28 days of data. Building picture..."
```

---

---

## PR #2 Analysis — New Blockers from suyash-web-console-ui (April 12, 2026)

PR #2 adds 11 new component files (Tier2Cards, WaldoCalendar, SignalDepthCard, etc.) with rich charts. All the historical charts currently use **synthetic seeded-random data** that must be replaced with real backend data. Summary of what's fake and what's needed.

---

### CRITICAL — The `DateEntry` fix that unblocks everything

**Root cause of all 7-day/30-day chart fakes:** `DateEntry` (the lightweight per-day summary used to build `allDates`) only has `crs, zone, tier` — no raw metric values. If we add the key metrics to `DateEntry`, the dashboard can build all historical sparklines client-side from already-loaded data. **No new API endpoints needed.**

**Single fix — add to `DateEntry` in types.ts + `fetchDates()` Edge Function:**
```typescript
interface DateEntry {
  // existing fields...
  date: string;
  crs: number;
  zone: 'peak' | 'moderate' | 'low' | 'nodata';
  // ADD THESE:
  hrvAvg: number | null;          // avg RMSSD/SDNN for the day
  restingHR: number | null;       // resting HR bpm
  sleepHours: number | null;      // total sleep hours
  sleepDebtHours: number | null;  // cumulative debt on this day
  strainScore: number | null;     // Load score (0–21)
  spO2: number | null;            // SpO2 % if measured
  respiratoryRate: number | null; // breaths/min if measured
}
```

**This single change unblocks:** HRVCard 30-day chart, SleepDebtCard 7-day chart, RestingHRCard 7-day sparkline, LoadCard 7-day average reference line, BodyReadings SpO2 + resp rate.

**Edge Function to update:** `supabase/functions/check-triggers/` or whichever builds the `dates` list for `fetchDates()`.

**Effort:** 1 day

---

### 16. HRVCard — 30-day history is fake

**Card:** `Tier2Cards.tsx > HRVCard`

**What's fake:** `generateHRVHistory(todayAvg)` — seeded random 30-day HRV array derived from today's single value. The baseline band (±15%) is computed from this fake history.

**Impact:** The "30-day history · your personal baseline" chart shows a plausible-looking but entirely synthetic line.

**Fix:** Once `DateEntry` has `hrvAvg`, build the 30-day history client-side from `allDates.slice(-30).map(d => d.hrvAvg)`.

**Effort:** 0.5 days (after DateEntry fix above)

---

### 17. RestingHRCard — 7-day sparkline is fake

**Card:** `Tier2Cards.tsx > RestingHRCard`

**What's fake:** `generateRHRHistory(today)` — seeded random 7 values around today's resting HR.

**Fix:** Once `DateEntry` has `restingHR`, build from `allDates.slice(-7).map(d => d.restingHR)`.

**Effort:** 0.5 days (after DateEntry fix)

---

### 18. SleepDebtCard — 7-day accumulation history is fake

**Card:** `Tier2Cards.tsx > SleepDebtCard`

**What's fake:** `generateSleepDebtHistory(debtHours)` — seeded random 7-day debt progression.

**Impact:** The stepped area chart shows fictional debt accumulation. The direction indicator is correct (from `data.sleepDebt.direction`), but the shape of the chart is invented.

**Fix:** Once `DateEntry` has `sleepDebtHours`, build from `allDates.slice(-7).map(d => d.sleepDebtHours)`.

**Effort:** 0.5 days (after DateEntry fix)

---

### 19. LoadCard — 7-day average reference line is fake

**Card:** `LoadCard.tsx`

**What's fake:** `const avgRef = Math.round(loadScore * 0.85)` — literally 85% of today's score. Not a real average.

**Impact:** The bullet graph reference line ("7-day avg") is always 85% of whatever today's score is.

**Fix:** Once `DateEntry` has `strainScore`, compute real 7-day average from `allDates.slice(-7).map(d => d.strainScore)`.

**Effort:** 0.5 days (after DateEntry fix)

---

### 20. FormCard CRS day chart — hourly progression is synthetic

**Card:** `FormCard.tsx > CrsDayChart`

**What's fake:** The entire hourly CRS curve (6am–10pm) is generated from a sine wave seeded from `score / 100`. The "past vs projected" split uses current clock time.

**Impact:** The chart looks authentic but is not real. Every user at CRS 73 sees the same shape.

**What's needed:** Either:
- Option A (simple): Remove the chart or explicitly label it "estimated pattern" until real data exists
- Option B (real): `hourlyFormEstimate: { hour: number; score: number }[]` computed server-side from intraday HR + activity data
- Option C (hybrid): Compute from hourly stress events already stored — `stress.events` has timestamps

**Recommended:** Option C — derive a rough hourly Form curve from existing `stress.events` and `activity` data. Not perfect but data-grounded.

**Effort:** 3 days

---

### 21. BodyReadings — SpO2 hardcoded to 97, resp rate derived from RHR

**Card:** `BodyReadings.tsx`

**What's fake:**
- `const spo2 = 97` — hardcoded normal value, card never shows
- `Math.round(data.restingHR / 4.2)` — respiratory rate estimated from RHR (medically unsound)

**Fix:**
- Add `spO2: number | null` to `DayResponse` (data is stored, just not surfaced)
- Add `respiratoryRate: number | null` to `DayResponse` (Apple Watch captures this during sleep)

Both fields exist in `health_snapshots` — just need surfacing in the day response Edge Function.

**Effort:** 0.5 days

---

### 22. CircadianCard — score not computed

**Card:** `Tier2Cards.tsx > CircadianCard`

**What's missing:** `data.crs.circadian.score` is always 0 — backend doesn't compute Circadian Score.

This is the same as P0 blocker #4 above — listed again here for completeness.

**Effort:** 2 days

---

### 23. SignalDepthCard — needs SyncStatus[] passed from Dashboard

**Card:** `SignalDepthCard.tsx`

**Status:** ✅ Data contract is correct — takes `SyncStatus[]` which is fetchable via `cloud.fetchSyncStatuses()`.

**Gap:** `Dashboard.tsx` doesn't currently fetch sync statuses on mount and pass them to `SignalDepthCard`.

**Fix:** Add `cloud.fetchSyncStatuses(userId)` to the initial `Promise.all` in Dashboard mount, store in state, pass to `SignalDepthCard`.

**Effort:** 1 hour

---

## Changelog

| Date | Update |
|---|---|
| 2026-04-11 | Initial doc created from backend audit + dashboard design session |
| 2026-04-12 | PR #2 analysis: 8 new blockers (16–23). Root cause: DateEntry missing time-series fields. Single fix unblocks 5 of the 8. |
