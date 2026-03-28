# Waldo MVP -- Consolidated Engineering PRD

**Version:** 4.0 (Final)
**Date:** March 15, 2026
**Status:** Full technical reference — read alongside MVP_SCOPE.md

> This document merges the original Engineering PRD (March 6), the Synthesized MVP Plan (March 6), and the Tech Stack Deep Dive with 7 Critical Changes (March 7). Every API endpoint, data type, npm package, and function definition has been verified against current documentation as of March 2026.
>
> **Scope note:** The 12-week build sequence below is the full reference plan. The **definitive 8-week MVP scope** (what to actually build first) is in [MVP_SCOPE.md](MVP_SCOPE.md). When in doubt, MVP_SCOPE.md wins.

---

## 1. What We Are Building

**One sentence:** An AI agent on your phone that reads your body signals from your watch and messages you on Telegram when you are stressed, tired, or about to make a bad decision -- before you realize it yourself.

**Scope:** A mobile app (Android-first) that reads biometric data from the user's smartwatch via Health Connect, computes a Cognitive Readiness Score (CRS) on-device, and uses a Claude-powered AI agent to send proactive, biometric-triggered interventions via Telegram. The agent has memory, learns from user feedback, and operates in Advisor mode (suggests, does not act autonomously).

---

## 2. Target User & Primary Device

**User:** Android phone owner who wears a Samsung Galaxy Watch 5/6/7 or Google Pixel Watch 3/4. Knowledge worker, startup founder, or remote worker who experiences burnout and wants their health data to actually DO something.

**Primary wearable for MVP:** Samsung Galaxy Watch 6 (via Health Connect). This device writes the richest data to Health Connect among Android wearables: continuous HR, HRV (RMSSD) every 10 minutes during daytime, sleep stages, SpO2, skin temperature, steps, exercise sessions, and calories.

**Secondary support (no extra work):** Any device that writes to Health Connect (Pixel Watch, Fitbit, OnePlus Watch, Amazfit, Xiaomi). The app reads from Health Connect, not from device-specific APIs. If a device writes data to HC, we read it.

**Primary interaction device:** Phone (app for dashboard + settings) and Telegram (for AI agent conversations + proactive messages).

---

## 3. Architecture Overview

```
+------------------------------------------------------------------+
|                        WEARABLE LAYER                            |
|                                                                  |
|  Samsung GW --[Sensor SDK]--> Wearable Data Layer --+            |
|  Garmin --[Connect IQ]--> CIQ Mobile SDK -----------+            |
|  Oura/WHOOP/Fitbit --[Cloud REST APIs]--------------+            |
|  Any Android --[Health Connect]----------------------+            |
|                                                      |            |
|                                                      v            |
|  +------------------------------------------------------+       |
|  |         REACT NATIVE APP (Expo SDK 53+)               |       |
|  |         with Kotlin Native Modules                     |       |
|  |                                                        |       |
|  |  Kotlin WorkManager module --> Background sync (15m)   |       |
|  |  Kotlin HealthConnect module --> Read sensors           |       |
|  |  Kotlin WearOS module --> Watch communication           |       |
|  |  ON-PHONE CRS computation (offline-capable)            |       |
|  |  ON-PHONE weighted stress confidence scoring           |       |
|  |  op-sqlite + SQLCipher --> Local encrypted storage      |       |
|  |  Custom upload queue --> Sync to Supabase               |       |
|  |  Zustand (UI state) + MMKV (KV) + TanStack Query       |       |
|  |  NativeWind v4 + custom health components               |       |
|  |  CRS Gauge + Charts (gifted-charts) + Dashboard         |       |
|  +-------------------------+----------------------------+       |
|                            | Custom upload queue sync           |
|                            v                                     |
|  +------------------------------------------------------+       |
|  |              SUPABASE BACKEND                         |       |
|  |                                                        |       |
|  |  Postgres --> health_snapshots, sleep, baselines       |       |
|  |  pg_cron --> scheduled triggers                        |       |
|  |  pgmq --> message queue                                |       |
|  |  pg_notify --> high-priority message delivery           |       |
|  |  Edge Functions:                                       |       |
|  |    telegram-webhook --+                                |       |
|  |    whatsapp-webhook --+--> message-processor            |       |
|  |    check-triggers ----+    (rules pre-filter +          |       |
|  |                            Claude agent loop)           |       |
|  |    message-sender --> Telegram API / WhatsApp API       |       |
|  |    morning-brief, compute-baselines                     |       |
|  +-------------------------+----------------------------+       |
|                            |                                     |
|                            v                                     |
|  +------------------------------------------------------+       |
|  |              CLAUDE AI LAYER                          |       |
|  |                                                        |       |
|  |  Messages API (tool_use, ReAct loop)                   |       |
|  |  Rules-based pre-filter: skip Claude on normal data    |       |
|  |  8 MVP tools: health (4), memory (2), comms (1), util (1)|      |
|  |  Claude Haiku 4.5 only (single model for MVP)          |       |
|  |  Prompt caching: SOUL.md + BODY.md (2 blocks)          |       |
|  |  Safety guardrails + output validation                  |       |
|  +------------------------------------------------------+       |
|                                                                  |
|  +------------------------------------------------------+       |
|  |              MESSAGING LAYER                          |       |
|  |                                                        |       |
|  |  Telegram (grammY) <--> User                           |       |
|  |  WhatsApp (Cloud API) <--> User                        |       |
|  |  Proactive templates for outside 24h window             |       |
|  |  6-digit code linking to Supabase Auth                  |       |
|  +------------------------------------------------------+       |
+------------------------------------------------------------------+
```

---

## 4. Technology Stack -- FINAL

| Layer | Technology | Package / Service | Notes |
|-------|-----------|-------------------|-------|
| Mobile App | React Native + Expo SDK 53+ (custom dev client) | `expo` ~53+, `expo-dev-client` | Free |
| Native Modules | Kotlin via Expo Modules API | Expo Modules API | For HC, WorkManager, WearOS |
| Health Data (Android) | Native Kotlin HealthConnectClient | Expo native module (replaces `react-native-health-connect`) | Direct API, no community bridge |
| Background Sync | Native Kotlin WorkManager | Expo native module (replaces `expo-background-task`) | No JS cold-start, better OEM survival |
| Watch Comms | Native Kotlin Data Layer API | Expo native module (replaces `react-native-wear-connectivity`) | Full API access, reliable callbacks |
| OEM Battery | Native Kotlin module + in-app guidance | Expo native module (replaces `react-native-autostarter`) | Direct PowerManager access |
| Local DB | op-sqlite + SQLCipher | `@op-engineering/op-sqlite` | AES-256 encrypted, $0 cost |
| Sync | Custom upload queue + periodic pull | Hand-built (replaces PowerSync) | Append-only data needs no sync engine |
| State Management | Zustand + TanStack Query + MMKV | `zustand`, `@tanstack/react-query`, `react-native-mmkv` | Client + server + KV |
| UI Components | NativeWind v4 + custom health components | `nativewind` v4 | Replaces Gluestack-UI v3 |
| Charts | react-native-gifted-charts + custom SVG gauge | `react-native-gifted-charts` | MVP charts |
| CRS Computation | On-phone (TypeScript) | In-app algorithm | Offline, instant, better privacy |
| Stress Detection | Weighted confidence scoring (on-phone) | In-app algorithm | Replaces binary AND gates |
| Backend + DB + Auth | Supabase | Supabase Free -> Pro ($25/mo) | Free -> $25/mo |
| Serverless Functions | Supabase Edge Functions (Deno) | Built-in | Free (500K invocations/mo) |
| Cron Scheduling | Supabase pg_cron | Built-in with Pro plan | Included |
| Message Queue | pgmq + pg_notify (high-priority) | Built-in | Zero infrastructure |
| AI Agent | Anthropic Claude Messages API (tool_use) | `@anthropic-ai/sdk` | Pay-per-use |
| AI Model (MVP) | Claude Haiku 4.5 | $1.00/MTok in, $5.00/MTok out | All calls in MVP — add routing in Phase 2 |
| AI Pre-filter | Rules-based (no AI) | Custom Edge Function logic | Saves 60-80% of AI costs |
| Telegram Bot | grammY (Deno native) | `grammy` | Free |
| WhatsApp Bot | Raw HTTP to Cloud API v21.0 | Direct HTTP | Templates for proactive |
| Push Notifications | Expo Push + FCM | `expo-notifications` | Free |
| Landing Page | Vercel | Free hobby tier | Free |
| Domain + SSL | Cloudflare Registrar | ~$12-18/year | ~$1.50/mo |

### "Why NOT" Table

| Rejected | Why |
|----------|-----|
| PowerSync ($49+/mo) | Health data is append-only. No conflicts possible. Custom SQLite sync is trivial and free |
| react-native-health-connect | Community-maintained with permission edge cases. Native Kotlin via Expo Modules API gives direct HealthConnectClient access |
| expo-background-task | Brand new (SDK 53), unproven at scale. Native Kotlin WorkManager eliminates JS cold-start (1-3s overhead) |
| react-native-wear-connectivity | Low adoption (~50-100 stars), unreliable callbacks. Native Kotlin Data Layer API gives full access |
| Gluestack-UI v3 | Waldo dashboard is custom enough that pre-built components save minimal time. NativeWind v4 gives more flexibility |
| Terra API ($399/mo) | Health Connect + native Kotlin covers all target devices for $0 |
| LangChain / LangGraph | Claude API with tool_use gives us the ReAct loop natively. No middleware needed |
| Claude Agent SDK | Overkill -- expects persistent runtime. Waldo agent is well-defined: wake, read, compose, sleep |
| Vercel AI SDK | Marginal benefit over raw API for server-side Edge Functions |
| Mastra | Too new, too risky for a health app |
| Firebase | Supabase gives Postgres + Edge Functions + Auth + Realtime in one |
| Flutter | Team knows React Native. Expo ecosystem is stronger for rapid iteration |
| Pure Kotlin (no RN) | No iOS path without full rewrite. Slower UI development for dashboard/charts/onboarding |
| Mixed-model routing (DeepSeek/Qwen) | Premature optimization. Start with Claude family. Add routing when needed |
| ROOK / Terra SDK | Health Connect + native Kotlin covers target devices. Add ROOK when Oura/WHOOP/Garmin API users needed |

---

## 5. Key Architecture Decisions -- 7 Critical Changes (March 7)

These decisions override the March 6 plan wherever conflicts exist.

### Change 1: Replace PowerSync with Custom SQLite Sync

**What changed:** PowerSync removed. Using op-sqlite + SQLCipher with a hand-built upload queue.

**Why:** Health sensor readings are append-only immutable facts. A heart rate of 72 BPM at 14:30:05 will never change. No conflicts possible (phone is sole writer). No bidirectional sync needed. PowerSync solves a problem Waldo does not have, at $49+/month past free tier.

**Sync architecture:**
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

### Change 2: Hybrid Native Approach -- Kotlin Modules for Critical Paths

**What changed:** Three community React Native libraries replaced with custom Kotlin native modules built via Expo Modules API.

**Why:**
- `react-native-health-connect` has permission handling edge cases
- `expo-background-task` is brand new, unproven at scale
- `react-native-wear-connectivity` has low adoption, unreliable callbacks
- JS cold-start in background tasks adds 1-3s overhead on every wake
- OEM battery killers more likely to kill JS-based background processes

**What to build in Kotlin:**
1. Health Connect integration (direct HealthConnectClient)
2. Background sync service (native WorkManager, no JS cold-start)
3. Wear OS communication (full Data Layer API access)
4. OEM battery optimization detection and workarounds (direct PowerManager access)

**Effort estimate:** 1-2 weeks to build all four modules.

### Change 3: Move CRS Computation to On-Phone

**What changed:** CRS is computed in the app, not in a Supabase Edge Function.

**Why:**
- Works offline (no server dependency)
- Instant (sub-millisecond computation vs network round-trip)
- Better privacy (raw IBI never leaves device)
- Negligible battery impact (<1ms computation)
- Upload the computed CRS + stress score to Supabase, not raw sensor data

### Change 4: Replace Binary Stress Detection with Weighted Confidence Scoring

**What changed:** The AND-gate stress detector (`HRV drop > 20% AND HR elevated > 15% AND persists 10min AND NOT exercising`) is replaced with a weighted confidence system.

**Why:** If any single signal is missing (common with wrist sensors), the binary system fails entirely. Weighted scoring degrades gracefully.

**New algorithm:**
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

### Change 5: Add Time-of-Day Normalization for HRV

**What changed:** HRV comparisons now use time-adjusted baselines instead of a single daily baseline.

**Why:** HRV naturally dips in the afternoon. Without adjustment, comparing 3pm RMSSD to overnight baseline will systematically trigger false stress alerts every afternoon. This is the single most impactful addition to reduce false positives.

**Implementation:**
```
After 7+ days of data, compute per-user RMSSD patterns in 4-hour blocks:
  00:00-04:00 (deep sleep):  ratio = 1.30
  04:00-08:00 (waking):      ratio = 1.10
  08:00-12:00 (morning):     ratio = 1.00 (reference)
  12:00-16:00 (afternoon):   ratio = 0.85 (natural dip)
  16:00-20:00 (evening):     ratio = 0.90
  20:00-24:00 (pre-sleep):   ratio = 1.05

adjustedBaseline = overallBaseline * timeOfDayRatio[currentBlock]
```

Before personal data accumulates, use the population defaults above.

### Change 6: Fix Artifact Rejection -- Interpolate Instead of Delete

**What changed:** Ectopic beat handling now interpolates with local median instead of deleting.

**Why:** Deleting ectopic beats biases RMSSD downward because it removes the largest successive differences.

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

### Change 7: Add Rules-Based Pre-Filter Before Claude Calls

**What changed:** A simple rules engine evaluates health data BEFORE invoking Claude. If everything is normal, Claude is not called.

**Why:** 60-80% of 15-minute health checks show normal readings. Skipping Claude on these saves the majority of AI costs.

**Implementation:**
```
function shouldInvokeClaude(data):
  if data.crs_score > 60 AND data.stress_confidence < 0.3:
    return false  // Everything normal, skip AI entirely
  return true
```

---

## 6. Data Flow

```
SENSOR --> SCORE --> AGENT --> MESSAGE --> FEEDBACK

1. SENSOR: Wearable writes to Health Connect
   |  Samsung GW / Pixel Watch / Fitbit -> HC records
   |  (every few minutes: HR; every 10 min: HRV; nightly: sleep stages)
   v
2. PHONE READS: Kotlin WorkManager wakes every 15 min
   |  -> Kotlin HealthConnect module reads: HR, HRV, RHR, sleep, steps
   |  -> Artifact rejection (interpolation, not deletion)
   |  -> Time-of-day normalization applied to HRV baseline
   v
3. SCORE: On-phone CRS computation (TypeScript)
   |  -> CRS = weighted(HRV_0.25, Sleep_0.35, Circadian_0.25, Activity_0.15)
   |  -> Stress confidence = weighted scoring (not binary AND gates)
   |  -> Store in local SQLite (op-sqlite + SQLCipher)
   v
4. SYNC: Upload queue sends to Supabase
   |  -> POST computed CRS + stress + summary metrics (not raw IBI)
   |  -> Supabase INSERT ... ON CONFLICT DO NOTHING (dedup)
   v
5. PRE-FILTER: Rules engine evaluates (no AI cost)
   |  -> CRS > 60 AND stress_confidence < 0.3? Skip Claude entirely
   |  -> Otherwise: invoke agent
   v
6. AGENT: Claude Messages API (tool_use ReAct loop)
   |  -> Model selected by severity: Haiku / Sonnet / Opus
   |  -> Context: cached personality + user profile + fresh biometrics
   |  -> Tools: get_current_biometrics, send_message, etc.
   |  -> Output validation: scan for banned medical claims
   v
7. MESSAGE: Delivered via Telegram (or WhatsApp)
   |  -> grammY sends message with inline keyboard
   |  -> High-priority: pg_notify (immediate)
   |  -> Normal priority: pgmq (next cron tick)
   v
8. FEEDBACK: User responds
   |  -> Thumbs up/down on CRS prediction
   |  -> Stored in crs_feedback table
   |  -> Weekly batch: adjust per-user CRS weights +/- 0.02
   |  -> Core memory updated with learned patterns
```

### Stress Detection Pipeline Latency

```
Worst case end-to-end: watch sensor -> proactive message

Background task buffer:    0-15 min  (biggest bottleneck)
Phone CRS computation:     <100ms
Upload to Supabase:        1-10s
pg_cron detection:         0-60s (or immediate via pg_notify)
Pre-filter evaluation:     <500ms
Agent loop (Sonnet, 3x):   ~10s
Message delivery:           <1s
-------------------------------------
WORST CASE TOTAL:          ~17 min
TYPICAL CASE:              ~2-5 min
```

The 15-min background task interval is the bottleneck, not the backend. Local push notification on-phone is immediate when stress confidence >= 0.60.

---

## 7. API Endpoints & Edge Functions

### Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `process-health-data` | Called by app after background sync | Receives computed CRS + stress from phone, stores snapshot, runs pre-filter, fires agent if needed |
| `check-triggers` | pg_cron every minute | Checks all active heartbeat rules against latest snapshots, fires biometric triggers if conditions met |
| `process-message` | Telegram/WhatsApp webhook | Receives user message, assembles context, calls Claude, returns response |
| `send-morning-brief` | pg_cron at user's preferred time | Assembles overnight health summary, calls Claude (Sonnet) for brief, sends via Telegram |
| `compute-baselines` | pg_cron daily at 3am | Recomputes personal baselines from last 7 days of snapshots, including time-of-day ratios |
| `adjust-crs-weights` | pg_cron weekly Sunday 2am | Analyzes feedback, adjusts per-user CRS weights |
| `message-sender` | pgmq consumer (pg_cron every 30s) + pg_notify listener | Dequeues messages and sends via Telegram/WhatsApp API |

### Telegram Webhook Setup

```
POST https://api.telegram.org/bot{TOKEN}/setWebhook
Body: { "url": "https://{PROJECT}.supabase.co/functions/v1/process-message" }
```

### Health Data Upload Endpoint

The app POSTs computed health data to `process-health-data`:

```typescript
// POST body from app
{
  user_id: string,
  timestamp: string,             // ISO 8601
  crs: number,                   // 0-100, computed on-phone
  crs_components: {
    hrv_balance: number,         // 0-100
    sleep_recovery: number,      // 0-100
    circadian_alignment: number, // 0-100
    activity_balance: number     // 0-100
  },
  stress_confidence: number,     // 0-1
  hr: number,
  hrv_rmssd: number | null,
  resting_hr: number,
  steps_last_hour: number,
  sleep_score: number | null,
  sleep_minutes: number | null,
  deep_minutes: number | null,
  rem_minutes: number | null,
  hours_since_wake: number,
  hrv_quality_pct: number | null // percent valid IBIs in window
}
```

### Rules-Based Pre-Filter (in process-health-data)

```typescript
function shouldInvokeClaude(snapshot: HealthSnapshot): boolean {
  // Normal readings -- skip Claude entirely
  if (snapshot.crs > 60 && snapshot.stress_confidence < 0.3) {
    return false;
  }
  // Check cooldown: no intervention within last 30 minutes
  const lastIntervention = await getLastIntervention(snapshot.user_id);
  if (lastIntervention && minutesSince(lastIntervention) < 30) {
    return false;
  }
  return true;
}
```

### Claude Agent Call (in process-message and triggered interventions)

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

// Select model by severity
function selectModel(context: AgentContext): string {
  if (context.isCrisis || context.isWeeklyAnalysis) return 'claude-opus-4-20250514';
  if (context.isConversation || context.isMorningBrief) return 'claude-sonnet-4-20250514';
  return 'claude-haiku-4-5-20251001'; // routine proactive messages
}

const response = await client.messages.create({
  model: selectModel(context),
  max_tokens: 1024,
  system: [
    // BLOCK 1: CACHED -- personality + safety + tools (same for all users)
    { type: "text", text: personalityAndSafetyRules, cache_control: { type: "ephemeral" } },
    // BLOCK 2: CACHED -- user profile + core memory (stable per user)
    { type: "text", text: userProfileAndMemory, cache_control: { type: "ephemeral" } },
    // BLOCK 3: FRESH -- current biometrics + trigger context
    { type: "text", text: currentContext }
  ],
  messages: conversationHistory,
  tools: toolDefinitions,
});
```

### Output Validation (before sending any message)

```typescript
const BANNED_PHRASES = [
  "you are having", "diagnosed with", "heart attack",
  "stop taking", "increase your dosage", "medical emergency",
  "you should see a doctor immediately"
];

function validateOutput(message: string): string {
  for (const phrase of BANNED_PHRASES) {
    if (message.toLowerCase().includes(phrase)) {
      return "I noticed something in your health data worth paying attention to. " +
        "Consider checking in with a healthcare professional if you have concerns.";
    }
  }
  return message;
}
```

### Timeout Management

```typescript
const FUNCTION_TIMEOUT = 140_000; // 10s buffer before 150s Edge Function limit
const startTime = Date.now();

// Before each Claude call in ReAct loop
function hasTimeRemaining(): boolean {
  return (Date.now() - startTime) < (FUNCTION_TIMEOUT - 30_000);
}
```

### 8 MVP Agent Tools

> **Phase 2 tools** (calendar, email, intervention-specific, schedule_message, search_conversation_history) are defined in AGENT_AND_BACKEND.md. Do not build them for MVP — the agent can suggest interventions via natural language without dedicated tools.

```typescript
const tools = [
  // Health (4)
  { name: "get_current_biometrics", description: "Get user's current CRS, stress level, HR, HRV, SpO2",
    input_schema: { type: "object", properties: {} } },
  { name: "get_sleep_summary", description: "Get last night's sleep summary (duration, stages, efficiency, score)",
    input_schema: { type: "object", properties: {} } },
  { name: "get_stress_events", description: "Get recent stress events with timestamps and confidence scores",
    input_schema: { type: "object", properties: { hours: { type: "number" } } } },
  { name: "get_health_history", description: "Get health metrics trend over N days (CRS, HRV, sleep)",
    input_schema: { type: "object", properties: { days: { type: "number" } }, required: ["days"] } },

  // Memory (2)
  { name: "read_core_memory", description: "Read user's long-term memory (patterns, preferences, goals, insights)",
    input_schema: { type: "object", properties: {} } },
  { name: "update_core_memory", description: "Save an important pattern or preference to long-term memory",
    input_schema: { type: "object", properties: {
      section: { type: "string" }, key: { type: "string" }, value: { type: "string" }
    }, required: ["section", "key", "value"] } },

  // Communication (1)
  { name: "send_message", description: "Send a message to user on Telegram",
    input_schema: { type: "object", properties: {
      message: { type: "string" }, reply_markup: { type: "object" }
    }, required: ["message"] } },

  // Utility (1)
  { name: "get_current_time", description: "Get current time and date in user's timezone",
    input_schema: { type: "object", properties: {} } },
];
```

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

### Context Budget Per Call

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

Target: <6000 tokens for routine calls, <10000 for conversations.

### Tool Result Compression

For large tool results (e.g., 7-day health history), compress before feeding back to context:
```
Instead of raw arrays of 672 data points:
Return: { period, avg_hr, avg_hrv, avg_crs, trend, notable_events_count }
```

### Agent Orchestration

1. **Parallel tool execution:** When Claude requests multiple tools in one response, execute them concurrently with `Promise.all()`.
2. **Streaming + typing indicator:** For user-facing conversations, send Telegram "typing" action immediately, then deliver response when ready.
3. **Debounce burst data:** When multiple health snapshots arrive at once (phone reconnects after offline), only evaluate the most recent one for stress. Do not spawn multiple agent loops.
4. **Audit logging:** Log every agent interaction: model used, tools called, tokens consumed, response generated. Essential for debugging false alerts and cost tracking.

---

## 8. Database Schema

```sql
-- Users
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  telegram_chat_id BIGINT,
  whatsapp_phone TEXT,
  preferred_channel TEXT DEFAULT 'telegram',
  autonomy_level INTEGER DEFAULT 1, -- 1 = Advisor
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Health baselines (auto-computed)
CREATE TABLE health_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  resting_hr FLOAT DEFAULT 65,
  hrv_baseline FLOAT DEFAULT 42,
  avg_sleep_minutes FLOAT DEFAULT 420,
  chronotype TEXT DEFAULT 'neutral', -- 'early', 'normal', 'late'
  chronotype_midpoint_hours FLOAT, -- midpoint of sleep in hours
  peak_hours JSONB DEFAULT '{"start": 10, "end": 14}',
  crs_weights JSONB DEFAULT '{"hrv": 0.25, "sleep": 0.35, "activity": 0.15, "circadian": 0.25}',
  time_of_day_ratios JSONB DEFAULT '{"00-04": 1.30, "04-08": 1.10, "08-12": 1.00, "12-16": 0.85, "16-20": 0.90, "20-24": 1.05}',
  cumulative_sleep_debt_minutes FLOAT DEFAULT 0,
  last_computed_at TIMESTAMPTZ,
  data_days INTEGER DEFAULT 0
);

-- Health snapshots (received from phone, CRS computed on-device)
CREATE TABLE health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT now(),
  hr FLOAT,
  hrv_rmssd FLOAT,
  resting_hr FLOAT,
  steps_last_hour INTEGER,
  sleep_score FLOAT,
  sleep_minutes INTEGER,
  deep_minutes INTEGER,
  rem_minutes INTEGER,
  light_minutes INTEGER,
  crs INTEGER,
  crs_hrv_balance FLOAT,
  crs_sleep_recovery FLOAT,
  crs_circadian_alignment FLOAT,
  crs_activity_balance FLOAT,
  stress_confidence FLOAT, -- 0-1 (weighted, not binary)
  stress_classification TEXT, -- 'ALERT', 'LOG', 'IGNORE'
  hours_since_wake FLOAT,
  hrv_quality_pct FLOAT, -- percent valid IBIs in window
  source TEXT DEFAULT 'health_connect',
  UNIQUE (user_id, timestamp, source)
);

-- CRS feedback
CREATE TABLE crs_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT now(),
  predicted_crs INTEGER,
  user_rating BOOLEAN, -- true = thumbs up, false = thumbs down
  context_note TEXT,
  snapshot_id UUID REFERENCES health_snapshots(id)
);

-- Agent interactions (message history + audit log)
CREATE TABLE agent_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT now(),
  role TEXT NOT NULL, -- 'user', 'assistant', 'system', 'tool'
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'telegram', -- 'telegram', 'whatsapp', 'app', 'push'
  model_used TEXT, -- 'haiku', 'sonnet', 'opus', null
  tokens_in INTEGER,
  tokens_out INTEGER,
  tools_called JSONB,
  importance_score FLOAT DEFAULT 0.5,
  metadata JSONB
);

-- Core memory (structured long-term patterns)
CREATE TABLE core_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  section TEXT NOT NULL, -- 'identity', 'health_profile', 'preferences', 'patterns', 'active_goals', 'recent_insights'
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now(),
  last_referenced TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, section, key)
);

-- Heartbeat rules (proactive task schedule)
CREATE TABLE heartbeat_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'time_based', 'biometric_trigger'
  schedule_cron TEXT, -- for time-based: '0 7 * * *'
  trigger_condition JSONB, -- for biometric: {"stress_confidence_threshold": 0.6, "cooldown_minutes": 30}
  action_prompt TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_fired_at TIMESTAMPTZ
);

-- Cron execution log
CREATE TABLE cron_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT, -- 'success', 'error'
  error_message TEXT,
  rows_processed INTEGER
);

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE crs_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE core_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE heartbeat_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies (user can only access their own data)
CREATE POLICY "Users own data" ON user_profiles FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users own data" ON health_baselines FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users own data" ON health_snapshots FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users own data" ON crs_feedback FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users own data" ON agent_interactions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users own data" ON core_memory FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users own data" ON heartbeat_rules FOR ALL USING (user_id = auth.uid());

-- Indexes for query performance
CREATE INDEX idx_snapshots_user_time ON health_snapshots(user_id, timestamp DESC);
CREATE INDEX idx_snapshots_stress ON health_snapshots(user_id, stress_classification) WHERE stress_classification = 'ALERT';
CREATE INDEX idx_interactions_user_time ON agent_interactions(user_id, timestamp DESC);
CREATE INDEX idx_core_memory_user_section ON core_memory(user_id, section);
CREATE INDEX idx_feedback_user ON crs_feedback(user_id, timestamp DESC);
CREATE INDEX idx_heartbeat_enabled ON heartbeat_rules(user_id) WHERE enabled = true;
```

### Default Heartbeat Rules (Pre-configured for New Users)

```json
[
  {
    "rule_name": "Stress Intervention",
    "rule_type": "biometric_trigger",
    "trigger_condition": {
      "stress_confidence_threshold": 0.60,
      "cooldown_minutes": 30
    },
    "action_prompt": "User's stress confidence has exceeded threshold. Current CRS is {crs}. Send a brief, non-judgmental Telegram message acknowledging the stress, offering 2-3 quick options (breathing exercise, short break, or just acknowledging). Include CRS feedback buttons.",
    "enabled": true
  },
  {
    "rule_name": "Morning Brief",
    "rule_type": "time_based",
    "schedule_cron": "0 7 * * *",
    "action_prompt": "Generate a morning brief. Include: last night's sleep score and key metrics (deep/REM/total), morning CRS with component breakdown, energy prediction based on sleep quality + cumulative sleep debt. Keep it under 5 sentences. Include CRS feedback button.",
    "enabled": true
  },
  {
    "rule_name": "Evening Wind-down",
    "rule_type": "time_based",
    "schedule_cron": "0 21 * * *",
    "action_prompt": "Generate an evening message. Include: today's CRS average, number of stress episodes detected, steps total, and a gentle suggestion for tonight's sleep. Keep it under 4 sentences.",
    "enabled": true
  }
]
```

---

## 9. Build Sequence (12-Week Reference Plan)

> The condensed **8-week MVP plan** is in [MVP_SCOPE.md](MVP_SCOPE.md). This 12-week sequence is the full reference including all Phase 1 features. Weeks 9–12 (Samsung watch companion, onboarding polish, beta prep) may slip to Phase 2 without blocking core loop validation.

### Phase 1: Foundation (Weeks 1-3)

**Week 1: Project Setup + Backend + Native Module Scaffolding**
- [ ] Initialize Expo project with SDK 53+, custom dev client
- [ ] Set up Expo Modules API for Kotlin native modules
- [ ] Start Health Connect native Kotlin module (replaces react-native-health-connect)
- [ ] Set up Supabase project (database, auth, Edge Functions)
- [ ] Run database migrations (all tables + indexes + RLS)
- [ ] Set up op-sqlite + SQLCipher (local encrypted DB)
- [ ] Configure EAS Build (development profile)
- [ ] VALIDATE: Read real Health Connect data from Samsung Galaxy Watch on physical device

**Week 2: Health Data + On-Phone CRS + Background Sync**
- [ ] Complete Kotlin HealthConnect module (HR, HRV, sleep, steps, SpO2)
- [ ] Build Kotlin WorkManager module for background sync (replaces expo-background-task)
- [ ] Implement custom SQLite upload queue (replaces PowerSync)
- [ ] Implement CRS computation ON-PHONE (TypeScript algorithm, corrected weights)
- [ ] Implement corrected artifact rejection (interpolation, not deletion)
- [ ] Implement time-of-day HRV normalization (population defaults initially)
- [ ] Implement weighted stress confidence scoring (replaces binary AND gates)
- [ ] Implement OEM battery optimization detection (Kotlin module)
- [ ] Write health data to local SQLite, sync to Supabase

**Week 3: Dashboard UI**
- [ ] Set up NativeWind v4 (replaces Gluestack-UI v3)
- [ ] Build CRS gauge component (custom SVG) with component breakdown display
- [ ] Build metric cards (HR, HRV, steps, SpO2, sleep, circadian)
- [ ] Build sleep summary component
- [ ] Build weekly trend chart (gifted-charts)
- [ ] Build insight card component
- [ ] Dark mode support
- [ ] Pull-to-refresh sync

### Phase 2: AI + Messaging (Weeks 4-7)

**Week 4: Telegram Bot + Rules Pre-Filter**
- [ ] Create Telegram bot via BotFather
- [ ] Build telegram-webhook Edge Function (grammY)
- [ ] Build message-processor Edge Function (Claude agent loop)
- [ ] Implement rules-based pre-filter BEFORE Claude calls (saves 60-80% AI cost)
- [ ] Implement weighted stress confidence threshold evaluation
- [ ] Implement tool definitions (health tools first)
- [ ] Basic conversation: user asks, bot answers with health data
- [ ] Set up prompt caching (3-block structure)
- [ ] Implement output validation (banned medical phrases)

**Week 5: WhatsApp Bot**
- [ ] Set up Meta Business app
- [ ] Build whatsapp-webhook Edge Function
- [ ] Webhook signature verification
- [ ] Message sending (free-form + templates)
- [ ] Create and submit template messages for approval
- [ ] Unified messaging abstraction (router for Telegram + WhatsApp)

**Week 6: Proactive Intelligence**
- [ ] Build check-triggers Edge Function
- [ ] Build message-sender Edge Function (pgmq consumer)
- [ ] Add pg_notify for high-priority message delivery (eliminates up to 60s latency)
- [ ] Set up pg_cron jobs (check-triggers, message-sender)
- [ ] Build morning-brief Edge Function (uses Sonnet)
- [ ] Model routing (Skip / Haiku / Sonnet / Opus)
- [ ] Rate limiting and cooldown logic
- [ ] Debounce burst data (offline reconnect scenario)

**Week 7: Memory + Context**
- [ ] Implement structured core_memory (sections: identity, health_profile, preferences, patterns, goals, insights)
- [ ] Implement core_memory tools (read/update with section + key)
- [ ] Conversation history management (last 5-10 messages)
- [ ] Build compute-baselines Edge Function (7-day recomputation + time-of-day ratios)
- [ ] Build adjust-crs-weights Edge Function (weekly feedback analysis)
- [ ] Implement cumulative sleep debt tracking
- [ ] Feedback loop (inline keyboard with thumbs up/down)
- [ ] Safety guardrails in system prompt
- [ ] Audit logging (model, tools, tokens per interaction)

### Phase 3: Onboarding + Polish (Weeks 8-9)

**Week 8: Onboarding Flow**
- [ ] Build 5-step onboarding screens
- [ ] Health Connect permission flow (careful UX, graceful degradation)
- [ ] Wearable connection flow
- [ ] Channel linking (6-digit code for Telegram/WhatsApp)
- [ ] AI onboarding interview (Claude extracts profile from conversation)
- [ ] Cold start: use first night of sleep HRV as immediate personal baseline
- [ ] "Learning Mode" indicator for first 7 days

**Week 9: Calendar + Email + Polish**
- [ ] Google OAuth integration (Calendar + Gmail scopes)
- [ ] Calendar tools (get_upcoming_events, suggest_reschedule)
- [ ] Email tools (get_recent_emails, search_emails)
- [ ] History screen (calendar view + daily detail + charts)
- [ ] Settings screen (all options)
- [ ] Edge cases: no wearable, no messaging, offline behavior
- [ ] Foreground service notification (optional, auto-enable on Samsung/Xiaomi)

### Phase 4: Watch Companion Apps (Weeks 10-12)

**Week 10: Samsung Watch Companion**
- [ ] Set up Kotlin Wear OS project
- [ ] Integrate Samsung Health Sensor SDK
- [ ] Implement HR + IBI continuous tracker
- [ ] Implement skin temperature tracker (GW5+)
- [ ] Send data via Wearable Data Layer API (MessageClient)
- [ ] Receive on phone side (Kotlin WearOS native module)
- [ ] Compute RMSSD from raw IBI on-phone (with corrected artifact pipeline)

**Week 11: Garmin Watch App**
- [ ] Set up Connect IQ project (Monkey C)
- [ ] Implement Sensor + SensorHistory data collection
- [ ] HR, IBI, SpO2, temperature, stress, Body Battery
- [ ] Send via Communications.transmit()
- [ ] Build native Android bridge for Connect IQ Mobile SDK
- [ ] Receive on phone side via bridge

**Week 12: Integration + Testing**
- [ ] End-to-end testing: watch -> phone -> CRS -> Supabase -> pre-filter -> Claude -> message
- [ ] Test on real devices (Samsung GW6/7, Garmin, Pixel Watch)
- [ ] OEM battery testing (Samsung, Xiaomi)
- [ ] Load testing (simulate 50-100 users)
- [ ] Fix bugs, polish UX
- [ ] Prepare for Google Play submission (Health Connect declaration)

---

## 10. What's In vs What's Out (MVP Scope)

### IN (MVP)

| Feature | Details |
|---------|---------|
| Android app (React Native + Expo) | Dashboard, CRS gauge with component breakdown, history, settings |
| Health Connect integration (native Kotlin) | HR, HRV, sleep stages, RHR, steps, SpO2 |
| On-phone CRS computation | Offline-capable, sub-millisecond, component breakdown |
| Weighted stress confidence scoring | Handles missing data, time-of-day normalized |
| Artifact rejection (interpolation) | Corrected pipeline, quality percentage tracking |
| Background sync (native Kotlin WorkManager) | 15-minute interval, OEM battery optimization handling |
| Local encrypted storage (op-sqlite + SQLCipher) | Custom upload queue to Supabase |
| Telegram bot (grammY) | Conversations, proactive messages, inline feedback |
| WhatsApp bot (Cloud API) | Same as Telegram, with template messages |
| Claude AI agent (Messages API + tool_use) | 18 tools, model routing, prompt caching |
| Rules-based pre-filter | Skip Claude on normal readings (60-80% cost savings) |
| Proactive stress interventions | Confidence-based trigger, 30-min cooldown |
| Morning brief + evening wind-down | Scheduled via pg_cron |
| Core memory (structured sections) | Long-term user patterns and preferences |
| CRS feedback loop | Thumbs up/down, weekly weight adjustment |
| Onboarding (<5 min) | HC permissions, channel link, first-night baseline |
| Samsung watch companion | Raw IBI streaming via Wearable Data Layer |
| Garmin watch app | Connect IQ sensor data |

### OUT (Not in MVP)

| Feature | Why Cut | When to Add |
|---------|---------|-------------|
| iOS / Apple HealthKit | Android-first proves the thesis | After 500 Android users |
| In-app chat UI | Use Telegram/WhatsApp instead | Phase 2 |
| Google Calendar integration | Adds scope; test core health loop first | Week 9 (if time) or Phase 2 |
| Gmail integration | Same as calendar | Week 9 (if time) or Phase 2 |
| Multi-model routing (DeepSeek/Qwen) | Premature optimization | At 100+ users when costs matter |
| Sub-agent architecture | Single model per call is sufficient | Phase 2 |
| ROOK / Terra integration | Health Connect + native Kotlin covers target devices | When Oura/WHOOP/Garmin API users needed |
| Memory compaction / RAG | Under 500 users, memory tables will not bloat | Phase 2 (pgvector) |
| Progressive autonomy (L0/L2/L3) | One mode (L1 Advisor) validates the concept | Phase 2 |
| Skills marketplace | Platform feature, premature | Phase 3 |
| A2A protocol | No external agents to connect to yet | Phase 3 |
| Social features / leaderboards | Not core to wellness value prop | Phase 3 |
| Paid subscription / monetization | Validate first | After PMF |
| Multi-language support | English-only for MVP | Phase 2 |
| Advanced analytics dashboard | Basic charts sufficient for MVP | Phase 2 |
| Frequency-domain HRV (LF/HF) | Scientifically debunked (Billman 2013) | Never |
| Non-linear HRV (SampEn) | Research value but not MVP | Phase 2 |
| Wearable-specific watch faces | Cool but not core | Phase 3 |
| EHR / medical record integration | Regulatory complexity | Phase 3+ |

---

## 11. Success Criteria

| Metric | Target | How Measured |
|--------|--------|-------------|
| Onboarding completion rate | >80% of installs | `user_profiles.onboarding_complete` |
| First CRS feedback within 24h | >60% of users | `crs_feedback` table |
| Biometric trigger engagement | >50% of triggered users respond | Telegram callback_data tracking |
| CRS thumbs-up rate (population defaults) | >65% | `crs_feedback` aggregation |
| CRS thumbs-up rate (after 2 weeks) | >75% | `crs_feedback` aggregation |
| Daily active engagement | >40% DAU/MAU | `agent_interactions` count per day |
| Telegram response rate | >70% of agent messages get reply/reaction | Delivery + read receipts |
| Stress intervention "helpful" rating | >50% find first intervention useful | Post-intervention feedback |
| False positive stress alerts | <20% of ALERT-level triggers are false | User feedback on stress alerts |
| Background sync reliability | >95% of scheduled syncs complete | Sync success logging |
| Proactive message latency | <5 min typical from stress detection to message | Timestamp comparison |
| Onboarding time | <5 minutes including AI interview | Timestamp tracking |
| Claude API cost per user | <$1.50/month | `agent_interactions` token tracking |

### Cost Targets

| Service | 10 users | 100 users | 500 users |
|---------|----------|-----------|-----------|
| Supabase | Free | $25/mo | $25/mo |
| Claude API | ~$5/mo | ~$50/mo | ~$250/mo |
| WhatsApp templates | $0 | $5-10/mo | $25-50/mo |
| Health APIs | $0 | $0 | $0 |
| Telegram | $0 | $0 | $0 |
| Expo/Vercel | $0 | $0 | $0 |
| **Total** | **~$5/mo** | **~$80/mo** | **~$325/mo** |

Note: Claude costs are significantly lower than original estimates because the rules-based pre-filter skips AI on 60-80% of health checks (normal readings).

---

## 12. NOTES & RECOMMENDATIONS

### Algorithm Notes

**CRS Weights (research-backed, corrected from original PRD):**

| Component | Original PRD | CORRECTED | Rationale |
|-----------|-------------|-----------|-----------|
| HRV | 0.40 | **0.25** | Daytime wrist HRV too noisy for 40% weight |
| Sleep | 0.30 | **0.35** | Military research: strongest predictor of cognitive readiness |
| Circadian | 0.15 | **0.25** | SAFTE model: 25%+ of performance variance |
| Activity | 0.15 | **0.15** | Moderate effect, mostly contextual |

**HRV: Use RMSSD only for MVP.** Skip SDNN (needs 5+ min windows), pNN50 (r > 0.95 with RMSSD, adds no info), LF/HF ratio (scientifically debunked per Billman 2013). Use lnRMSSD internally for statistics (log-normalizes the skewed distribution).

**Morning CRS vs Live CRS:** Morning CRS (from overnight data) is the most reliable score. Live CRS (updated every 15 min) is supplementary and should be shown with a confidence indicator. Stress alerts should only fire when confidence > 0.60 AND live CRS drops > 15 points from morning CRS.

**Cold Start:** Use first night of sleep HRV as immediate personal baseline (with wide confidence intervals that narrow over time). One night of real data is better than any population norm.

**Cumulative Sleep Debt:**
```
Target: 56h/week (8h/night)
Track rolling 7-day actual sleep
Per hour of accumulated deficit: -5 points from sleep debt sub-score
Floor at 20 (don't zero out)
Weight within SleepRecovery: 15% of the sleep component
```

**Chronotype Estimation (no lab test needed):**
```
midpointOfSleep = 14-day rolling average of (sleepStart + sleepEnd) / 2
  < 2:30 AM  -> "early" (alertness peak ~10am)
  2:30-4:00  -> "normal" (peak ~11:30am)
  > 4:00 AM  -> "late" (peak ~1pm)
```

**CRS Component Breakdown (show to user, like Oura):**
```
CRS: 72
  Sleep Recovery: 80 (good)
  HRV Balance: 65 (below baseline)
  Circadian Alignment: 75 (on track)
  Activity Balance: 70 (adequate)
```

Transparency builds trust and helps users understand what is affecting their score.

### Health Connect Data Types (Reference)

| Data Type | HC Record Type | Permission String | Used in CRS? |
|-----------|---------------|-------------------|-------------|
| Heart Rate | `HeartRateRecord` | `READ_HEART_RATE` | Yes (HRV component) |
| Heart Rate Variability | `HeartRateVariabilityRmssdRecord` | `READ_HEART_RATE_VARIABILITY` | Yes (primary stress signal) |
| Resting Heart Rate | `RestingHeartRateRecord` | `READ_RESTING_HEART_RATE` | Yes (baseline) |
| Sleep Sessions | `SleepSessionRecord` (with stages) | `READ_SLEEP` | Yes (35% weight) |
| Blood Oxygen (SpO2) | `OxygenSaturationRecord` | `READ_OXYGEN_SATURATION` | Phase 2 |
| Skin Temperature | `SkinTemperatureRecord` | `READ_SKIN_TEMPERATURE` | Phase 2 |
| Steps | `StepsRecord` | `READ_STEPS` | Yes (15% weight) |
| Exercise Sessions | `ExerciseSessionRecord` | `READ_EXERCISE` | Informational |
| Active Calories | `ActiveCaloriesBurnedRecord` | `READ_ACTIVE_CALORIES_BURNED` | Informational |
| Respiratory Rate | `RespiratoryRateRecord` | `READ_RESPIRATORY_RATE` | Phase 2 |

**Background Read Permission (Android 15+):** `READ_HEALTH_DATA_IN_BACKGROUND` -- allows reading HC data without the app being in the foreground.

**Historical Data Access:** By default, apps can access 30 days of historical data. `READ_HEALTH_DATA_HISTORY` extends this to all historical data.

**Cannot use Expo Go.** Must use custom dev client (`expo-dev-client`) because Health Connect requires native modules.

### Samsung Galaxy Watch Data Availability

| Variable | Written to HC? | Quality Notes |
|----------|---------------|---------------|
| Heart Rate | Yes | Reliable, continuous during exercise |
| HRV (RMSSD) | Partial | Robust during sleep, sporadic daytime |
| Sleep Stages | Yes | LIGHT, DEEP, REM, AWAKE stages |
| Resting HR | Partial | Sometimes delays sync |
| SpO2 | Partial | Not always auto-written to HC |
| Skin Temperature | Yes | During sleep, relative delta |
| Steps | Yes | Very reliable |
| Exercise | Yes | Good metadata |

**Implication:** Reliable HR, sleep stages, and steps from all devices. HRV robust during sleep but sporadic during daytime for Samsung. Stress detection should use HR elevation as secondary signal when HRV unavailable -- this is handled by the weighted confidence scoring system.

### Production System Lessons

| System | Key Lesson for Waldo |
|--------|----------------------|
| Garmin Body Battery | Consider "battery" view alongside CRS (trajectory vs snapshot) |
| WHOOP Recovery | Uses 30-day baselines (more stable than 7-day). Falls back to sleep-only model |
| Oura Readiness | Shows component breakdown with color coding. Transparency = trust |
| Samsung Stress | On-demand only, NOT continuous passive. Even Samsung does not trust passive daytime HRV |

**Implication:** Be conservative with daytime stress. Make it a "soft" CRS modifier, not a hard alert trigger. Morning CRS (from overnight data) is the most reliable score. Daytime is supplementary.

### Core Memory Structure

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

Add importance scoring per memory entry (high-relevance items included first if approaching token limits), temporal decay (archive unreferenced memories after 30 days), and weekly reflection (Opus call reviews trends and updates insights in core memory).

### Open Questions (Decide Before Implementation)

1. **SQLCipher overhead:** ~10-15% read/write overhead. Recommended for health data sensitivity, but optional for wellness (not medical) app. Recommendation: use it.
2. **Raw IBI storage policy:** Store raw IBI locally for 7 days (reprocessing window), upload only computed RMSSD to server. Delete raw IBI older than 7 days on device.
3. **Samsung Sensor SDK distribution:** Research if watch companion app needs Samsung partner approval before Week 10. Fallback: sideload for beta.
4. **Foreground service notification:** Persistent "Waldo is monitoring" notification keeps background tasks alive on aggressive OEMs. Make it optional: auto-enable on Samsung/Xiaomi, hide on Pixel/stock Android.

### Build Order Risks

- **Health Connect must be validated in Week 1, not deferred.** If HC does not work reliably on Samsung, everything downstream fails. Get a Samsung Galaxy Watch on a real device and read data before writing any other code.
- **Samsung Sensor SDK distribution is unknown.** Apply for partnership in Week 1. If denied, the watch companion is dev-mode only (sideloaded beta testers).

### What Can Be Cut Further (If 12 Weeks Is Too Tight)

- **Cut the Samsung watch companion entirely.** Health Connect alone gives enough data for CRS + basic stress detection. The watch companion adds raw IBI (better HRV) but is not essential for the core thesis. This saves 2-3 weeks.
- **Cut onboarding to 3 steps** (permissions + Telegram link + done). AI interview can happen in-chat after first message.
- **Cut morning brief.** Start with stress alerts only. Morning brief is Phase 2.

### Technical Debt Awareness

- Custom SQLite sync needs retry logic, conflict handling, and monitoring. Build it properly from Week 2 or it will cause problems later.
- Kotlin native modules need to be well-documented since the JS/Kotlin bridge adds debugging complexity.
- The rules-based pre-filter needs careful threshold tuning -- too aggressive and real stress events are missed.

### Performance Concerns

- SQLCipher adds 10-15% read/write overhead. Acceptable for Waldo's data volume but monitor.
- Edge Function cold starts (500ms-2s) add latency to first call after idle. Warm functions with a health ping.
- Prompt caching hit rate depends on TTL (5min vs 1hr). If 1hr TTL is unavailable, costs roughly double.

### Developer Registrations (Do ASAP)

| Service | What to Do | Cost | Timeline |
|---------|-----------|------|----------|
| Google Play Console | Register, ID verification | $25 one-time | 2 weeks for verification |
| Meta Business App | WhatsApp sandbox (instant), business verification | Free | 2 weeks for verification |
| Expo account | Create account | Free | Instant |
| Supabase project | Create project | Free | Instant |
| Anthropic API | Get API key, set up billing | Pay-per-use | Instant |
| Telegram BotFather | Create bot, get token | Free | Instant |
| Samsung Developer | Account + Sensor SDK download | Free | Before Week 10 |
| Garmin Connect IQ SDK | Download | Free | Before Week 11 |
| Google Cloud Console | Calendar + Gmail APIs, OAuth consent | Free | Before Week 9 |
| Cloudflare | Register domain | ~$12/year | Anytime |

### Backend Scaling Path

| Phase | Architecture |
|-------|-------------|
| MVP (0-200 users) | Supabase only (Edge Functions + pg_cron + pgmq + pg_notify) |
| Growth (200-1000) | Add QStash for per-user scheduling + consider Inngest for agent workflows |
| Scale (1000+) | Add dedicated worker service (Railway/Fly.io) for agent loops |

### Data Volume Estimates (Per User)

| Data Type | Volume/Day | 90-Day Storage |
|-----------|-----------|----------------|
| HR (every 15 min) | 96 points, ~19 KB | ~1.7 MB |
| HRV readings | 6-10/day, ~2 KB | ~180 KB |
| Sleep session | 1/day, ~500 bytes | ~45 KB |
| Health snapshot | 96/day, ~47 KB | ~4.2 MB |
| Raw IBI (Samsung SDK, local only) | ~86,400 beats, ~675 KB | 7 days only (~4.7 MB) |
| **Total on server** | **~70 KB** | **~6 MB** |

Supabase free tier (500 MB) fits ~80 users with 90-day retention.

### File Structure

```
onesync/
|-- app.json                          # Expo config
|-- package.json
|-- modules/                          # Kotlin native modules (Expo Modules API)
|   |-- health-connect/               # Native HealthConnectClient
|   |   |-- android/
|   |   |   |-- src/main/java/.../HealthConnectModule.kt
|   |   |-- index.ts                  # JS bridge
|   |-- background-sync/              # Native WorkManager
|   |   |-- android/
|   |   |   |-- src/main/java/.../BackgroundSyncModule.kt
|   |   |-- index.ts
|   |-- wear-os/                      # Native Data Layer API
|   |   |-- android/
|   |   |   |-- src/main/java/.../WearOSModule.kt
|   |   |-- index.ts
|   |-- battery-optimizer/            # OEM battery optimization
|       |-- android/
|       |   |-- src/main/java/.../BatteryOptimizerModule.kt
|       |-- index.ts
|-- src/
|   |-- app/                          # Expo Router screens
|   |   |-- _layout.tsx
|   |   |-- index.tsx                 # Dashboard (CRS gauge + breakdown)
|   |   |-- onboarding.tsx
|   |   |-- history.tsx
|   |   |-- feedback.tsx
|   |   |-- settings.tsx
|   |-- hooks/
|   |   |-- useHealthConnect.ts
|   |   |-- useAuth.ts
|   |   |-- useTelegram.ts
|   |   |-- useCRS.ts
|   |-- lib/
|   |   |-- supabase.ts
|   |   |-- database.ts              # op-sqlite + SQLCipher setup
|   |   |-- syncQueue.ts             # Custom upload queue
|   |   |-- algorithms/
|   |   |   |-- crs.ts               # On-phone CRS computation
|   |   |   |-- sleep-score.ts
|   |   |   |-- stress.ts            # Weighted confidence scoring
|   |   |   |-- artifact-rejection.ts # IBI interpolation pipeline
|   |   |   |-- time-normalization.ts # Time-of-day HRV adjustment
|   |   |   |-- sleep-debt.ts        # Cumulative sleep debt
|   |   |-- notifications.ts
|   |-- components/
|       |-- CRSGauge.tsx              # Visual CRS with component breakdown
|       |-- StressIndicator.tsx
|       |-- SleepSummary.tsx
|       |-- FeedbackButton.tsx
|       |-- MetricCard.tsx
|       |-- TrendChart.tsx
|-- supabase/
|   |-- migrations/
|   |   |-- 001_initial.sql
|   |-- functions/
|       |-- process-health-data/
|       |   |-- index.ts              # Receives data, runs pre-filter, fires agent
|       |-- check-triggers/
|       |   |-- index.ts
|       |-- process-message/
|       |   |-- index.ts              # Telegram/WhatsApp webhook -> Claude -> response
|       |-- message-sender/
|       |   |-- index.ts              # pgmq consumer + pg_notify listener
|       |-- send-morning-brief/
|       |   |-- index.ts
|       |-- compute-baselines/
|       |   |-- index.ts              # Weekly recomputation + time-of-day ratios
|       |-- adjust-crs-weights/
|           |-- index.ts
|-- config/
    |-- soul.md                       # Agent personality
    |-- agents.md                     # Behavioral rules + safety guardrails
```

### References

- Task Force of ESC/NASPE (1996): HRV measurement standards
- Billman (2013): LF/HF ratio debunking
- Shaffer & Ginsberg (2017): HRV overview
- Kim et al. (2018): HRV-stress meta-analysis
- Borbely (1982): Two-process model of sleep regulation
- SAFTE-FAST model: Military cognitive readiness
- Berryhill et al. (2020): WHOOP Recovery validation
- Castaldo et al. (2015): Acute mental stress and HRV
- dontkillmyapp.com: OEM battery optimization documentation

---

*This document is the consolidated engineering source of truth for Waldo MVP. It incorporates the original PRD, the synthesized MVP plan, and all 7 critical changes from the March 7 tech stack deep dive. Build from this.*
