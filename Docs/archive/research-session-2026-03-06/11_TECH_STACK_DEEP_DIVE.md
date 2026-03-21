# OneSync -- Tech Stack Deep Dive & Recommendations

Last updated: March 7, 2026

This document synthesizes comprehensive research across 4 areas: Android app frameworks, backend/AI architecture, health algorithms, and offline-first data solutions. It identifies what to KEEP, what to CHANGE, and what to ADD from the March 6 plan.

---

## EXECUTIVE SUMMARY

The March 6 architecture is ~75% correct. The core decisions (React Native, Supabase, Claude Messages API, Telegram/WhatsApp) are sound. But the research revealed **7 critical changes** that will significantly improve reliability, accuracy, and cost:

| # | Change | Impact |
|---|--------|--------|
| 1 | Replace PowerSync with custom SQLite sync | Saves $49+/month, eliminates vendor lock-in, simpler for append-only health data |
| 2 | Hybrid native approach: write critical Kotlin modules for Health Connect + background sync + Wear OS | Dramatically improves reliability on Samsung/Xiaomi |
| 3 | Move CRS computation to on-phone | Works offline, lower latency, better privacy |
| 4 | Replace binary stress detection with weighted confidence scoring | Handles missing data, reduces false positives |
| 5 | Add time-of-day normalization for HRV | Eliminates systematic afternoon false alarms |
| 6 | Fix artifact rejection: interpolate instead of delete | Removes RMSSD bias from current algorithm |
| 7 | Add rules-based pre-filter before Claude calls | Saves 60-80% of AI costs (most checks are "everything normal") |

---

## PART 1: APP FRAMEWORK DECISION

### Comparison Matrix

| Criterion | React Native + Expo | Kotlin Native | Flutter |
|-----------|-------------------|---------------|---------|
| Background sync reliability | Adequate (new API) | **Best** | Good |
| Health Connect integration | Good (community lib) | **Best (native)** | Good |
| OEM battery killer handling | Weakest | **Best** | Moderate |
| Wear OS companion comms | Weak (need Kotlin anyway) | **Best (unified)** | Weak (need Kotlin anyway) |
| Local data processing | Adequate | **Best** | Good |
| Cross-platform (iOS later) | **Yes** | No | **Yes** |
| Development speed | **Fastest (Expo tooling)** | Moderate | Fast |
| Library ecosystem | **Largest** | Android-specific | Large |

### The Key Insight

Regardless of phone-side framework, the **Wear OS watch app MUST be Kotlin**. The question is only how the phone app communicates with it.

### RECOMMENDATION: React Native + Expo with Kotlin Native Modules

A **pragmatic hybrid approach**. Use React Native + Expo for:
- UI and dashboard (Gluestack-UI v3 / NativeWind)
- Navigation, state management, general app logic
- Expo's excellent developer tooling (EAS Build, OTA updates)

Write **critical native modules in Kotlin** (via Expo Modules API) for:
- Health Connect integration (direct `HealthConnectClient`, no community bridge)
- Background sync service (native WorkManager, no JS cold-start overhead)
- Wear OS communication (full Data Layer API access)
- OEM battery optimization detection and workarounds
- Device-specific whitelisting intents (Samsung, Xiaomi)

This gives you:
- Expo developer experience for 80% of the app
- Native reliability for the 20% that matters most (health data, background sync, watch comms)
- iOS path via React Native when ready (replace Kotlin modules with Swift)

### Why Not Pure Kotlin?

- No iOS path without a full rewrite
- Slower UI development for dashboard/charts/onboarding
- Smaller ecosystem for common patterns (navigation, state, animations)
- OneSync's differentiator is the AI + messaging, not the native UI

### Why Not Pure React Native (No Native Modules)?

- `react-native-health-connect` is community-maintained with permission handling edge cases
- `expo-background-task` is brand new (SDK 53), unproven at scale
- `react-native-wear-connectivity` has low adoption (~50-100 stars), unreliable callbacks
- JS cold-start in background tasks adds 1-3s overhead on every wake
- OEM battery killers more likely to kill JS-based background processes

### UI Component Decision

| Option | Verdict |
|--------|---------|
| **Gluestack-UI v3** | Good for rapid development, pre-built accessible components |
| **NativeWind v4** | Best for custom design (Tailwind in RN), pair with custom components |
| **Tamagui** | Powerful but over-complex for a health dashboard |

**Recommendation:** NativeWind v4 for styling flexibility. Build custom health-specific components (CRS gauge, metric cards, charts). Use Gluestack only if you want pre-built form/modal/sheet components to save time on settings screens.

---

## PART 2: OFFLINE-FIRST DATA LAYER

### Why PowerSync Is Overkill

Health sensor readings are **append-only immutable facts**. A heart rate of 72 BPM at 14:30:05 will never change. This means:
- No conflicts possible on health data (phone is sole writer)
- No bidirectional sync needed for health data (phone -> server only)
- Deduplication is trivial: `(user_id, recorded_at, source)` unique constraint
- Upload queue = `SELECT * FROM health_snapshots WHERE synced = false LIMIT 100`

PowerSync's value proposition (bidirectional sync with conflict resolution) solves a problem OneSync doesn't have, at $49+/month once you pass the free tier.

### RECOMMENDATION: Custom Sync with op-sqlite + SQLCipher

| Factor | PowerSync | Custom SQLite Sync |
|--------|-----------|-------------------|
| Cost at 100 users | ~$49-99/month | $0 |
| Implementation effort | 1-2 days | 1-2 weeks |
| Sync reliability | Proven, automatic | You build it (simple for append-only) |
| Vendor lock-in | Yes | None |
| Encryption | Limited | Full (SQLCipher) |
| Bidirectional sync | Yes (overkill) | Pull-only for server data (sufficient) |

### Sync Architecture

```
UPLOAD (phone -> server):
  Health Connect read -> Write to local SQLite (op-sqlite + SQLCipher)
  Background task -> SELECT unsynced rows -> POST batch to Supabase -> Mark synced
  Supabase: INSERT ... ON CONFLICT (user_id, recorded_at, source) DO NOTHING

DOWNLOAD (server -> phone):
  On app open + after each background sync:
  -> Fetch health_baselines from Supabase
  -> Fetch core_memory from Supabase
  -> Write to local SQLite
```

### Data Volume Estimates

| Data Type | Volume/Day | 90-Day Storage |
|-----------|-----------|----------------|
| HR (every 15 min) | 96 points, ~19 KB | ~1.7 MB |
| HRV readings | 6-10/day, ~2 KB | ~180 KB |
| Sleep session | 1/day, ~500 bytes | ~45 KB |
| Health snapshot | 96/day, ~47 KB | ~4.2 MB |
| Raw IBI (Samsung SDK) | ~86,400 beats, ~675 KB | ~60 MB |
| **Total per user** | **~750 KB (no IBI), ~1.4 MB (with IBI)** | **~6 MB (no IBI), ~66 MB (with IBI)** |

Well within device storage limits. Supabase free tier (500 MB) fits ~100 users with 90-day retention.

### State Management Stack (KEEP as-is)

| Layer | Choice | Role |
|-------|--------|------|
| **Zustand** | Client state | Dashboard view, UI prefs, onboarding, transient state |
| **TanStack Query** | Server state | Fetching baselines, core memory, API calls with caching |
| **MMKV** | Key-value store | Auth tokens, last sync timestamp, TanStack cache persistence |
| **op-sqlite + SQLCipher** | Local DB | Health time-series, encrypted at rest |

### Encryption

- **Local SQLite:** SQLCipher (AES-256) via op-sqlite. Encryption key stored in Android Keystore (via Expo SecureStore).
- **Supabase Postgres:** Encrypted at rest by default (AES-256).
- **MMKV:** Use encrypted mode for auth tokens and sensitive preferences.

---

## PART 3: BACKEND ARCHITECTURE

### Supabase Edge Functions: Confirmed, With Caveats

Edge Functions work for the MVP agent loop. Timing analysis:

| Operation | Latency |
|-----------|---------|
| Claude API call (Haiku) | 0.5-2s |
| Claude API call (Sonnet) | 1-4s |
| Claude API call (Opus) | 3-15s |
| Tool execution (DB query) | 50-200ms |
| 5-iteration ReAct loop (Sonnet) | 5-20s |
| **Edge Function timeout** | **150s** |

Sonnet loops fit comfortably. Opus with extended thinking could approach the limit.

### Stress Detection Pipeline Latency

```
Worst case end-to-end: watch sensor -> proactive message

Background task buffer:    0-15 min  (biggest bottleneck)
Phone CRS computation:     <100ms
Upload to Supabase:        1-10s
pg_cron detection:         0-60s
Gate evaluation:           <500ms
Agent loop (Sonnet, 3x):   ~10s
Message delivery:          <1s
-------------------------------------
WORST CASE TOTAL:          ~17 min
TYPICAL CASE:              ~2-5 min
```

The 15-min background task interval is the bottleneck, not the backend.

### Key Backend Optimizations

**1. Replace message-sender pg_cron with pg_notify for high-priority messages:**
When stress is detected, deliver immediately instead of waiting for next cron tick. This eliminates up to 60s of latency.

**2. Add rules-based pre-filter BEFORE calling Claude:**
```
function shouldInvokeClaude(data):
  if data.crs_score > 60 AND data.stress_confidence < 0.3:
    return false  // Everything normal, skip AI entirely
  return true
```
This saves 60-80% of API costs. Most 15-min checks show normal readings.

**3. Debounce burst data:**
When multiple health snapshots arrive at once (phone reconnects after offline), only evaluate the most recent one for stress. Don't spawn multiple agent loops.

### Message Queue: KEEP pgmq

pgmq is correct for MVP. Same database, zero infrastructure, handles hundreds of messages/day.

| Scale | Recommended Queue |
|-------|-------------------|
| 0-200 users | pgmq (current) |
| 200-1000 users | Add QStash for per-user scheduling |
| 1000+ users | Add BullMQ (Redis) or Inngest for workflow orchestration |

### Scheduling: KEEP pg_cron (with enhancement)

pg_cron works for MVP. Minimum 1-minute granularity. Add:
- Advisory locks to prevent overlapping runs
- Execution logging to a `cron_log` table
- Future: QStash for per-user scheduling (morning briefs at individual times)

### Backend Scaling Path

| Phase | Architecture |
|-------|-------------|
| MVP (0-200 users) | Supabase only (Edge Functions + pg_cron + pgmq) |
| Growth (200-1000) | Add QStash for scheduling + consider Inngest for agent workflows |
| Scale (1000+) | Add dedicated worker service (Railway/Fly.io) for agent loops |

---

## PART 4: AI AGENT SYSTEM

### Claude Messages API: CONFIRMED as Best Choice

The Agent SDK is designed for long-running, multi-step exploration tasks. OneSync's agent pattern is well-defined: wake, read health data, optionally check context, compose message, sleep. Messages API with tool_use gives full control and transparency.

| Framework | Verdict |
|-----------|---------|
| **Claude Messages API (direct)** | **KEEP -- best for OneSync** |
| Claude Agent SDK | Overkill, expects persistent runtime |
| LangChain / LangGraph | Adds abstraction without solving real problems |
| Vercel AI SDK | Marginal benefit over raw API for server-side |
| Mastra | Too new, too risky for health app |

### Model Routing (KEEP, with refinement)

| Scenario | Model | Cost/Call |
|----------|-------|----------|
| Routine health check (no alert needed) | **Skip Claude entirely** | $0 |
| Routine proactive message | Haiku | ~$0.001 |
| Morning briefing | Sonnet | ~$0.01 |
| User conversation | Sonnet | ~$0.01 |
| Complex health pattern analysis | Opus | ~$0.05 |
| Crisis/high severity | Opus | ~$0.05 |

The "skip Claude entirely" fast path is the single biggest cost optimization.

### Prompt Caching Strategy

```
System prompt structure:

[BLOCK 1 - CACHED] ~2000 tokens
  - Personality, safety rules (same for ALL users)
  - Tool definitions (same for ALL users)
  cache_control: { type: "ephemeral" }

[BLOCK 2 - CACHED] ~1000 tokens
  - User profile + core memory + baselines (stable per user, changes weekly)
  cache_control: { type: "ephemeral" }

[BLOCK 3 - FRESH] ~500 tokens
  - Current timestamp
  - Latest biometrics / CRS snapshot
  - Recent conversation (last 3-5 messages)
  - Trigger context (why this call?)
  (no cache_control -- always fresh)
```

Estimated savings: ~80-85% on cached tokens for a single active user (cache hit rate ~95% with 15-min call intervals).

### Context Engineering

**Context budget per call:**
- Target: <6000 tokens for routine calls, <10000 for conversations

| Component | Tokens | Priority |
|-----------|--------|----------|
| Safety rules + personality | ~500 | Always |
| Tool definitions (18 tools) | ~1500 | Always |
| User profile + core memory | ~300-500 | Always |
| Health baselines (7d/30d) | ~200 | Always |
| Current biometrics snapshot | ~200 | Always |
| Recent conversation (last 5 msgs) | ~500-1500 | Conversations only |
| Today's calendar events | ~200-500 | Morning brief + stress alerts |
| Trigger context | ~100-200 | Always |

**Conversation history strategy:**
- MVP: Stuff last 5-10 raw messages
- Phase 2: Add session summaries (Haiku summarizes each session to 2-3 sentences)
- Phase 3: RAG with pgvector for long-term memory search

### Core Memory Pattern (Enhanced)

Structure memory in sections instead of flat key-value:

```json
{
  "identity": { "name": "...", "age": 24, "chronotype": "late" },
  "health_profile": { "resting_hr": 62, "typical_sleep": "1am-8am" },
  "preferences": { "style": "direct", "interventions": ["breathing", "walks"] },
  "patterns": { "stress_triggers": ["deadlines"], "recovery_aids": ["gym"] },
  "active_goals": ["improve sleep consistency"],
  "recent_insights": ["HRV drops consistently on Monday afternoons"]
}
```

Add:
- **Importance scoring** per memory entry (high-relevance items included first if approaching token limits)
- **Temporal decay** (archive unreferenced memories after 30 days)
- **Weekly reflection** (Opus call reviews trends and updates insights in core memory)

### Tool Result Compression

For large tool results (e.g., 7-day health history), compress before feeding back to context:
```
Instead of raw arrays of 672 data points:
Return: { period, avg_hr, avg_hrv, avg_crs, trend, notable_events_count }
```

This keeps the agent informed while preventing context bloat.

### Agent Orchestration Improvements

**1. Parallel tool execution:**
When Claude requests multiple tools in one response, execute them concurrently with `Promise.all()`.

**2. Streaming + typing indicator:**
For user-facing conversations, send Telegram "typing" action immediately, then deliver response when ready.

**3. Timeout management:**
```
FUNCTION_TIMEOUT = 140s (10s buffer before 150s Edge Function limit)
Before each Claude call: check remaining time
If <30s remaining: return best response so far
```

**4. Output validation:**
Before sending any message, scan for banned medical claims:
```
BANNED: "you are having", "diagnosed with", "heart attack",
        "stop taking", "increase your dosage"
If detected: replace with safe fallback message
```

**5. Audit logging:**
Log every agent interaction: model used, tools called, tokens consumed, response generated. Essential for debugging false alerts and cost tracking.

---

## PART 5: HEALTH ALGORITHMS -- CRITICAL FIXES

### CRS Weight Correction

The PRD and algorithm docs disagree on weights. Research confirms:

| Component | PRD (wrong) | Algo Doc | Research-Backed | Rationale |
|-----------|-------------|----------|-----------------|-----------|
| HRV | 0.40 | 0.25 | **0.25** | Daytime wrist HRV too noisy for 40% |
| Sleep | 0.30 | 0.35 | **0.35** | Military research: strongest predictor |
| Circadian | 0.15 | 0.20 | **0.25** | SAFTE model: 25%+ of performance variance |
| Activity | 0.15 | 0.20 | **0.15** | Moderate effect, mostly contextual |

### HRV: Use RMSSD Only for MVP

| Metric | Verdict |
|--------|---------|
| **RMSSD** | **PRIMARY -- 2-min windows, updated every 30s** |
| lnRMSSD | Use internally for statistics (log-normalizes the skewed distribution) |
| SDNN | Skip (needs 5+ min, mixes sympathetic + parasympathetic) |
| pNN50 | Skip (r > 0.95 with RMSSD, adds no info) |
| LF/HF ratio | **NEVER USE -- scientifically debunked** (Billman 2013) |
| Frequency-domain | Skip for MVP entirely |
| Non-linear (SampEn) | Phase 2 consideration |

### FIX: Artifact Rejection -- Interpolate, Don't Delete

Current design deletes ectopic beats. This **biases RMSSD downward** (removes largest successive differences).

**Corrected pipeline:**
```
Step 1: Reject IBI < 300ms or > 2000ms (physiological range)
Step 2: Adaptive local median filter (5-point window)
        If IBI deviates > 25% from local median: flag as artifact
Step 3: INTERPOLATE flagged IBIs with local median (don't delete)
Step 4: Quality check: if >20% artifacts, discard window entirely
        Require 80% valid IBIs (~100 out of ~120-150 in 2-min window)
Step 5: If accelerometer available, tag motion-contaminated windows
```

### FIX: Replace Binary Stress Detection with Weighted Confidence Scoring

Current design uses AND gates: `HRV drop > 20% AND HR elevated > 15% AND persists 10min AND NOT exercising`. Problem: **if any single signal is missing, detection fails entirely**.

**Weighted confidence scoring:**
```
Compute stressConfidence:
  HRV component (weight 0.35): hrvScore = clamp(hrvDropPercent / 30, 0, 1)
  HR component (weight 0.25):  hrScore = clamp(hrElevationPercent / 25, 0, 1)
  Duration (weight 0.20):      durationScore = clamp(persistMinutes / 15, 0, 1)
  Activity context (weight 0.20): inverted (exercising = 0)

  normalizedConfidence = weightedSum / totalAvailableWeight
  If totalAvailableWeight < 0.40: insufficient data, return 0

  Thresholds:
    >= 0.60: ALERT (trigger proactive message)
    0.40-0.59: LOG (track but don't alert)
    < 0.40: IGNORE
```

Benefits: handles missing data gracefully, more nuanced, still fully explainable to users.

### ADD: Time-of-Day Normalization (Critical)

**The single most impactful addition to reduce false positives.**

HRV naturally dips in the afternoon. Without adjustment, comparing 3pm RMSSD to overnight baseline will systematically trigger false stress alerts every afternoon.

After 7+ days of data, compute per-user RMSSD patterns in 4-hour blocks:
```
00:00-04:00 (deep sleep):  ratio = 1.30 (30% above daily average)
04:00-08:00 (waking):      ratio = 1.10
08:00-12:00 (morning):     ratio = 1.00 (reference)
12:00-16:00 (afternoon):   ratio = 0.85 (natural dip)
16:00-20:00 (evening):     ratio = 0.90
20:00-24:00 (pre-sleep):   ratio = 1.05

adjustedBaseline = overallBaseline * timeOfDayRatio[currentBlock]
```

Now a 20% drop from the ADJUSTED baseline is meaningful.

### ADD: Cumulative Sleep Debt Tracking

Current design only considers last night. Military research shows cumulative debt is a strong independent predictor.

```
Target: 56h/week (8h/night)
Track rolling 7-day actual sleep
Per hour of accumulated deficit: -5 points from sleep debt sub-score
Floor at 20 (don't zero out)
Weight within SleepRecovery: 15% of the sleep component
```

### ADD: CRS Computation On-Phone (Not Server)

| Aspect | On-Phone | On-Server |
|--------|----------|-----------|
| Latency | Instant | Depends on sync + Edge Function |
| Offline | Works | Doesn't work |
| Privacy | Raw IBI never leaves device | Raw IBI sent to server |
| Battery | Negligible (<1ms computation) | Same upload cost either way |
| Complexity | Simple weighted formula | Same formula, different location |

CRS is a simple weighted formula on ~6 inputs. Compute it on-phone. Upload the result (not raw data) to Supabase.

### ADD: Show CRS Component Breakdown (Like Oura)

Don't just show "CRS: 72". Show:
```
CRS: 72
  Sleep Recovery: 80 (good)
  HRV Balance: 65 (below baseline)
  Circadian Alignment: 75 (on track)
  Activity Balance: 70 (adequate)
```

Transparency builds trust and helps users understand what's affecting their score.

### Cold Start Improvement

Current: population norms for 7 days. Better: **first night of sleep HRV as immediate personal baseline** (with wide confidence intervals that narrow as more nights accumulate). One night of real data >> any population norm.

### Chronotype Estimation

Use midpoint of sleep as proxy (no lab test needed):
```
midpointOfSleep = 14-day rolling average of (sleepStart + sleepEnd) / 2
  < 2:30 AM  -> "early" (alertness peak ~10am)
  2:30-4:00  -> "normal" (peak ~11:30am)
  > 4:00 AM  -> "late" (peak ~1pm)
```

### What Production Systems Teach Us

| System | Key Lesson for OneSync |
|--------|----------------------|
| **Garmin Body Battery** | Consider "battery" view alongside CRS (trajectory vs snapshot) |
| **WHOOP Recovery** | Uses 30-day baselines (more stable than 7-day). Falls back to sleep-only model |
| **Oura Readiness** | Shows component breakdown with color coding. Transparency = trust |
| **Samsung Stress** | On-demand only, NOT continuous passive. Even Samsung doesn't trust passive daytime HRV |

**Implication:** Be conservative. Make daytime stress a "soft" CRS modifier, not a hard alert trigger. Morning CRS (from overnight data) is your most reliable score. Daytime is supplementary.

---

## PART 6: COMPLETE REVISED TECH STACK

### Final Stack Table

| Layer | March 6 Choice | Revised Choice | Reason for Change |
|-------|----------------|----------------|-------------------|
| **Framework** | React Native + Expo SDK 53+ | **KEEP + add Kotlin native modules** | Hybrid approach for reliability |
| **Background sync** | expo-background-task | **Native Kotlin WorkManager module** | No JS cold-start, better OEM survival |
| **Health data** | react-native-health-connect | **Native Kotlin HealthConnectClient module** | Direct API, no community bridge |
| **Watch comms** | react-native-wear-connectivity | **Native Kotlin Data Layer API module** | Full API access, reliable callbacks |
| **State mgmt** | Zustand + TanStack Query + MMKV | **KEEP** | Correct combination |
| **Local DB** | PowerSync (SQLite) | **op-sqlite + SQLCipher** | No vendor lock-in, $0 cost, append-only needs no sync engine |
| **Sync** | PowerSync auto-sync | **Custom upload queue + periodic pull** | Simpler, cheaper, sufficient for append-only data |
| **UI components** | Gluestack-UI v3 | **NativeWind v4 + custom health components** | More flexibility for custom health UI |
| **Charts** | react-native-gifted-charts | **KEEP** | Good enough for MVP |
| **Backend** | Supabase | **KEEP** | Confirmed as best choice |
| **AI** | Claude Messages API (tool_use) | **KEEP + add pre-filter to skip Claude on normal readings** | Cost optimization |
| **Telegram** | grammy | **KEEP** | Correct choice |
| **WhatsApp** | Raw HTTP Cloud API | **KEEP** | Correct choice |
| **Message queue** | pgmq | **KEEP + add pg_notify for high-priority** | Latency optimization |
| **CRS location** | Edge Function | **On-phone** | Offline, instant, better privacy |
| **Stress detection** | Binary AND gates | **Weighted confidence scoring** | Handles missing data, fewer false positives |
| **Artifact rejection** | Delete bad IBIs | **Interpolate (local median)** | Removes RMSSD bias |
| **OEM battery** | react-native-autostarter | **Native Kotlin module + in-app guidance** | Direct PowerManager access |

---

## PART 7: OPEN QUESTIONS TO FINALIZE

Before starting implementation, these need decisions:

### 1. Kotlin Native Modules: Build Yourself or Use Expo Modules API?

Expo Modules API (Swift/Kotlin) lets you write native modules that integrate cleanly with Expo's build system. This is the recommended path -- you write Kotlin, Expo handles the bridging.

**Effort estimate:** 1-2 weeks to build HealthConnect + WorkManager + WearOS modules. This replaces 3 community libraries with one reliable native layer.

### 2. SQLCipher vs Unencrypted SQLite?

SQLCipher adds ~10-15% read/write overhead. For a wellness app (not medical device), it's optional but strongly recommended. Health data is sensitive even if not HIPAA-regulated.

**Recommendation:** Use SQLCipher. The overhead is negligible for OneSync's data volume.

### 3. NativeWind v4 vs Gluestack-UI v3?

If you want to build a distinctive health UI: NativeWind (more control, custom components).
If you want to ship faster with pre-built components: Gluestack.

**Recommendation:** NativeWind. OneSync's dashboard is custom enough (CRS gauge, health cards, trend charts) that pre-built components save minimal time.

### 4. How Much IBI Data to Store?

Raw IBI = ~675 KB/day per user. Options:
- **Store all raw IBI locally** (for on-device analysis), upload only computed RMSSD to server
- **Store raw IBI on server too** (for future ML training, but costs storage)
- **Discard raw IBI after computing RMSSD** (lightest, but can't reprocess later)

**Recommendation:** Store raw IBI locally for 7 days (reprocessing window), upload only computed metrics to Supabase. Delete raw IBI older than 7 days on device.

### 5. Samsung Sensor SDK Distribution Path?

Still unclear if distributing the watch companion app needs Samsung partner approval. Research this before Week 10. Fallback: sideload for beta, Garmin-first for broader distribution.

### 6. Morning CRS vs Real-Time CRS?

Given that Samsung doesn't even trust passive daytime HRV for automatic stress scoring, consider:
- **Morning CRS** (from overnight data): the "official" score, most reliable
- **Live CRS** (updated every 15 min): supplementary, shown with confidence indicator
- **Stress alerts**: only fire when confidence > 0.60 AND live CRS drops > 15 points from morning CRS

### 7. Foreground Service Notification?

A persistent "OneSync is monitoring your health" notification keeps background tasks alive on aggressive OEMs. It's ugly but effective. Make it optional: auto-enable on Samsung/Xiaomi, hide on Pixel/stock Android.

---

## PART 8: REVISED BUILD SEQUENCE

The 12-week timeline from March 6 remains valid with these adjustments:

### Week 1 Additions:
- Set up Expo Modules API for Kotlin native modules
- Start Health Connect native module (instead of installing react-native-health-connect)

### Week 2 Adjustments:
- Build custom SQLite sync instead of PowerSync setup
- Implement CRS computation on-phone (not Edge Function)
- Implement corrected artifact rejection (interpolation)
- Implement time-of-day normalization framework (uses population defaults until personal data accumulates)

### Week 4 Additions:
- Implement rules-based pre-filter before Claude calls
- Implement weighted stress confidence scoring (replaces binary gates)

### Week 6 Additions:
- Add pg_notify for high-priority message delivery
- Implement output validation (banned medical phrases)

Everything else stays as planned.

---

## REFERENCES

- Task Force of ESC/NASPE (1996): HRV measurement standards
- Billman (2013): LF/HF ratio debunking
- Shaffer & Ginsberg (2017): HRV overview
- Kim et al. (2018): HRV-stress meta-analysis
- Borbely (1982): Two-process model of sleep regulation
- SAFTE-FAST model: Military cognitive readiness
- Berryhill et al. (2020): WHOOP Recovery validation
- Castaldo et al. (2015): Acute mental stress and HRV
- dontkillmyapp.com: OEM battery optimization documentation
