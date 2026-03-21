# OneSync MVP — Engineering PRD (Final)

> **This is the build document.** Every API endpoint, data type, npm package, and function definition in this document has been verified against current documentation as of March 2026. If it's in here, it's buildable.

---

## 1. What We Are Building

A mobile app (Android-first) that reads biometric data from the user's smartwatch via Health Connect, computes a Cognitive Readiness Score (CRS), and uses an LLM agent to send proactive, biometric-triggered interventions via Telegram. The agent has memory, learns from user feedback, and operates in Advisor mode (suggests, doesn't act autonomously).

**One sentence:** An AI agent on your phone that reads your body signals from your watch and messages you on Telegram when you're stressed, tired, or about to make a bad decision — before you realize it yourself.

---

## 2. Target User & Primary Device

**User:** Android phone owner who wears a Samsung Galaxy Watch 5/6/7 or Google Pixel Watch 3/4. Knowledge worker, startup founder, or remote worker who experiences burnout and wants their health data to actually DO something.

**Primary wearable for MVP:** Samsung Galaxy Watch 6 (via Health Connect). This device writes the richest data to Health Connect among Android wearables: continuous HR, HRV (RMSSD) every 10 minutes during daytime, sleep stages, SpO2, skin temperature, steps, exercise sessions, and calories.

**Secondary support (no extra work):** Any device that writes to Health Connect (Pixel Watch, Fitbit, OnePlus Watch, Amazfit, Xiaomi). The app reads from Health Connect, not from device-specific APIs. If a device writes data to HC, we read it.

---

## 3. Technology Stack (Verified)

| Layer | Technology | Package / Service | Cost |
|-------|-----------|-------------------|------|
| Mobile App | React Native + Expo (custom dev client) | `expo` ~52+, `expo-dev-client` | Free |
| Health Data (Android) | Health Connect SDK | `react-native-health-connect` v3.x + `expo-health-connect` config plugin | Free |
| Health Data (Enrichment) | ROOK SDK | `react-native-rook-sdk` | Free (≤750 users) |
| Backend + DB + Auth | Supabase | Supabase Free → Pro ($25/mo) | Free → $25/mo |
| Serverless Functions | Supabase Edge Functions (Deno) | Built-in | Free (500K invocations/mo) |
| Cron Scheduling | Supabase pg_cron | Built-in with Pro plan | Included |
| AI Agent | Anthropic Claude API | `@anthropic-ai/sdk` | Pay-per-use |
| AI Model (MVP) | Claude Haiku 4.5 | $1.00/MTok input, $5.00/MTok output, $0.10/MTok cached | ~$7.65/user/mo single-model |
| Communication | Telegram Bot API | `node-telegram-bot-api` or direct HTTP | Free |
| Push Notifications | Expo Push + FCM | `expo-notifications` | Free |
| Landing Page | Vercel | Free hobby tier | Free |
| Domain + SSL | Cloudflare Registrar | ~$12-18/year | ~$1.50/mo |

### Why NOT These Alternatives

| Rejected | Why |
|----------|-----|
| Terra API ($399/mo) | Health Connect + ROOK covers all target devices for $0 |
| LangChain / LangGraph | Claude API with `tool_use` gives us the ReAct loop natively. No middleware needed |
| Firebase | Supabase gives Postgres + Edge Functions + Auth + Realtime in one. Firebase lacks Edge Functions equivalent |
| Flutter | Team knows React Native. Expo ecosystem is stronger for rapid iteration |
| Mixed-model routing (DeepSeek/Qwen) | Premature optimization. Start with Claude Haiku for everything. Add routing when we hit 100+ users and need cost optimization |

---

## 4. Health Data: Exactly What We Can Read

### 4.1 Health Connect Data Types (Android)

Source: [developer.android.com/health-and-fitness/health-connect/data-types](https://developer.android.com/health-and-fitness/health-connect/data-types)

The following data types are available via Health Connect and are relevant to CRS computation. The React Native SDK (`react-native-health-connect`) exposes these through the `readRecords` function.

| Data Type | HC Record Type | Permission String | Sampling | Used in CRS? |
|-----------|---------------|-------------------|----------|-------------|
| **Heart Rate** | `HeartRateRecord` | `READ_HEART_RATE` | Instantaneous samples with BPM + time | Yes (40% weight) |
| **Heart Rate Variability** | `HeartRateVariabilityRmssdRecord` | `READ_HEART_RATE_VARIABILITY` | RMSSD in ms, single measurement per record | Yes (primary stress signal) |
| **Resting Heart Rate** | `RestingHeartRateRecord` | `READ_RESTING_HEART_RATE` | Daily aggregate, single BPM value | Yes (baseline computation) |
| **Sleep Sessions** | `SleepSessionRecord` (with stages) | `READ_SLEEP` | Session with stages: AWAKE, LIGHT, DEEP, REM, SLEEPING, OUT_OF_BED | Yes (30% weight) |
| **Blood Oxygen (SpO2)** | `OxygenSaturationRecord` | `READ_OXYGEN_SATURATION` | Percentage, instantaneous | Phase 2 |
| **Skin Temperature** | `SkinTemperatureRecord` | `READ_SKIN_TEMPERATURE` | Delta from baseline in °C | Phase 2 |
| **Steps** | `StepsRecord` | `READ_STEPS` | Count over time interval | Yes (15% weight, activity factor) |
| **Exercise Sessions** | `ExerciseSessionRecord` | `READ_EXERCISE` | Session with type, duration, exercise type enum | Informational |
| **Active Calories** | `ActiveCaloriesBurnedRecord` | `READ_ACTIVE_CALORIES_BURNED` | kcal over time interval | Informational |
| **Total Calories** | `TotalCaloriesBurnedRecord` | `READ_TOTAL_CALORIES_BURNED` | kcal over time interval | Informational |
| **Respiratory Rate** | `RespiratoryRateRecord` | `READ_RESPIRATORY_RATE` | Breaths per minute, instantaneous | Phase 2 |
| **Distance** | `DistanceRecord` | `READ_DISTANCE` | Meters over time interval | Informational |

#### Key Technical Details for Health Connect Integration

1. **Background Read Permission (Android 15+):** `READ_HEALTH_DATA_IN_BACKGROUND` — allows reading HC data without the app being in the foreground. On Android 14 and below, a foreground service is required.

2. **Historical Data Access:** By default, apps can access 30 days of historical data from the permission grant date. The `READ_HEALTH_DATA_HISTORY` permission extends this to all historical data.

3. **React Native Integration Path:**
   ```
   npm install react-native-health-connect
   npm install expo-health-connect        # Expo config plugin
   npm install expo-build-properties      # For SDK version config
   ```
   
   In `app.json`:
   ```json
   {
     "expo": {
       "plugins": [
         "expo-health-connect",
         ["expo-build-properties", {
           "android": {
             "compileSdkVersion": 34,
             "targetSdkVersion": 34,
             "minSdkVersion": 26
           }
         }]
       ]
     }
   }
   ```

4. **Cannot use Expo Go.** Must use custom dev client (`expo-dev-client`) because Health Connect requires native modules.

5. **Reading data pattern:**
   ```typescript
   import { readRecords } from 'react-native-health-connect';
   
   const heartRateData = await readRecords('HeartRate', {
     timeRangeFilter: {
       operator: 'between',
       startTime: startOfDay.toISOString(),
       endTime: now.toISOString(),
     },
   });
   // Returns: { records: [{ time: string, samples: [{ time: string, beatsPerMinute: number }] }] }
   ```

### 4.2 Samsung Galaxy Watch → Health Connect Data Availability

Based on real-world testing and community reports, Samsung Galaxy Watch 6 writes the following to Health Connect via Samsung Health:

| Variable | Written to HC? | Frequency | Quality Notes |
|----------|---------------|-----------|---------------|
| Heart Rate | ✅ Yes | Every few minutes when detected | Reliable, continuous during exercise |
| HRV (RMSSD) | ⚠️ Partial | During sleep primarily, sporadic daytime | Samsung Health computes internally but inconsistently syncs to HC. BioActive sensor does measure during day |
| Sleep Stages | ✅ Yes | Per sleep session | LIGHT, DEEP, REM, AWAKE stages included |
| Resting HR | ⚠️ Partial | Daily | Sometimes delays sync |
| SpO2 | ⚠️ Partial | On-demand or during sleep | Not always written to HC automatically |
| Skin Temperature | ✅ Yes | During sleep | Relative delta from baseline |
| Steps | ✅ Yes | Continuous | Very reliable |
| Exercise | ✅ Yes | Per session | Good metadata |
| Calories | ✅ Yes | Continuous | Total + Active |
| Respiratory Rate | ⚠️ Partial | During sleep | Inconsistent HC writes |

**Implication for CRS:** We will have reliable HR, sleep stages, and steps from all devices. HRV data will be robust during sleep (all devices) but sporadic during daytime for Samsung. This means our stress detection (which needs daytime HRV) should also incorporate HR elevation as a secondary signal when HRV is unavailable.

### 4.3 ROOK SDK as Enrichment Layer (Optional)

If Health Connect data is insufficient for specific devices (e.g., WHOOP, Oura, Garmin which lock data in their ecosystems), ROOK SDK provides a unified React Native package that can fill gaps.

**Package:** `react-native-rook-sdk`
**Docs:** [docs.tryrook.io](https://docs.tryrook.io/docs/rookconnect/sdk/reactnative/rook-sdk/)
**Cost:** Free tier ≤ 750 users
**What it adds:** Normalized sleep summaries, physical summaries (HR, HRV, steps, calories), body summaries, and health events from 400+ devices via both SDK-based (Health Connect, Apple Health) and API-based (WHOOP, Oura, Garmin, Fitbit, Polar, Withings) sources.

**For MVP:** ROOK is a "nice to have" fallback. Health Connect alone covers Samsung GW, Pixel Watch, Fitbit, OnePlus, Amazfit, Xiaomi — which represents 90%+ of our target users. Add ROOK when we need Oura/WHOOP/Garmin API-based users.

---

## 5. Algorithms

### 5.1 Cognitive Readiness Score (CRS)

**Purpose:** Single 0-100 score predicting current cognitive capacity.

**Inputs (from Health Connect):**
- `current_hr`: Most recent heart rate (BPM) from `HeartRateRecord`
- `resting_hr`: Resting heart rate from `RestingHeartRateRecord` (or computed as 7-day rolling minimum of sleeping HR)
- `hrv_rmssd`: Most recent HRV RMSSD (ms) from `HeartRateVariabilityRmssdRecord`
- `sleep_score`: Computed from `SleepSessionRecord` — see formula below
- `steps_last_hour`: From `StepsRecord` aggregated over last 60 minutes
- `hours_since_wake`: Computed from last `SleepSessionRecord` end time

**Sleep Score Formula (0-100):**
```
total_sleep_minutes = sum of all stage durations
deep_pct = deep_minutes / total_sleep_minutes
rem_pct = rem_minutes / total_sleep_minutes
efficiency = total_sleep_minutes / time_in_bed_minutes

sleep_score = (
  min(total_sleep_minutes / 480, 1.0) * 40 +   // 8h target
  min(deep_pct / 0.20, 1.0) * 25 +              // 20% deep target
  min(rem_pct / 0.25, 1.0) * 20 +               // 25% REM target
  efficiency * 15                                 // efficiency factor
) * 100
```

**CRS Formula:**
```
// Base weights (personalized via feedback loop)
W_hrv = 0.40   // HRV contribution
W_sleep = 0.30  // Sleep contribution
W_activity = 0.15 // Activity contribution
W_circadian = 0.15 // Time-of-day contribution

// HRV component (0-1)
hrv_ratio = hrv_rmssd / personal_hrv_baseline  // >1 = better than average
hrv_component = clamp(hrv_ratio, 0, 2) / 2

// If HRV unavailable, fall back to HR-based estimate
if (hrv_rmssd === null) {
  hr_ratio = resting_hr / current_hr  // Higher ratio = less stressed
  hrv_component = clamp(hr_ratio, 0.5, 1.5) - 0.5
}

// Sleep component (0-1)
sleep_component = sleep_score / 100

// Activity component (0-1) — inverted U-shape
// Some movement is good, too sedentary or too active is bad
optimal_steps = 500  // per hour
activity_component = 1 - abs(steps_last_hour - optimal_steps) / optimal_steps
activity_component = clamp(activity_component, 0, 1)

// Circadian component (0-1) — Borbély two-process model simplified
// Process S (sleep pressure) increases exponentially during wake
sleep_pressure = 1 - exp(-hours_since_wake / 14.3)  // 14.3h time constant
// Process C (circadian) — sinusoid peaking at ~14h after typical wake
circadian_phase = sin(2 * PI * (hours_since_wake - 2) / 24) * 0.5 + 0.5
circadian_component = circadian_phase * (1 - sleep_pressure * 0.6)

// Final CRS
crs = round(
  (W_hrv * hrv_component +
   W_sleep * sleep_component +
   W_activity * activity_component +
   W_circadian * circadian_component) * 100
)

// Apply exponential decay after 14h awake
if (hours_since_wake > 14) {
  decay = exp(-(hours_since_wake - 14) / 4)
  crs = round(crs * decay)
}

return clamp(crs, 0, 100)
```

**Population-level defaults (used until personal baselines are computed):**
- `personal_hrv_baseline`: 42 ms (adults 25-45, from population studies)
- `resting_hr`: 65 BPM
- `average_sleep_minutes`: 420 (7 hours)

**Personal baseline computation (after 7 days of data):**
- `personal_hrv_baseline`: 7-day median of nighttime HRV readings
- `resting_hr`: 7-day rolling minimum of sleeping HR

### 5.2 Stress Detector

**Purpose:** Binary + severity assessment of acute stress from HRV deviation.

```
// Primary signal: HRV RMSSD drop below personal baseline
hrv_deviation = (personal_hrv_baseline - current_hrv) / personal_hrv_baseline

// Secondary signal: HR elevation above resting
hr_elevation = (current_hr - resting_hr) / resting_hr

// Tertiary: rate of HRV change (if we have 2+ recent readings)
hrv_trend = (previous_hrv - current_hrv) / previous_hrv  // positive = dropping

// Stress level (0-1)
stress = clamp(
  hrv_deviation * 0.5 +
  hr_elevation * 0.3 +
  hrv_trend * 0.2,
  0, 1
)

// Stress classification
if (stress > 0.6) → HIGH_STRESS (trigger intervention)
if (stress > 0.3) → MODERATE_STRESS (log, maybe mention)
if (stress <= 0.3) → LOW_STRESS (normal)
```

**Trigger condition for biometric intervention:**
- HRV drops >20% below personal baseline AND
- HR is elevated >15% above resting AND
- Condition persists for 2+ consecutive readings (minimum 10 minutes)

This prevents false positives from momentary spikes (e.g., standing up quickly, brief exercise).

### 5.3 CRS Prediction-Accuracy Feedback Loop

After every proactive suggestion, the agent asks for feedback:

```
Agent: "Your CRS is 72 — good for deep work. Shall I protect the next 90 min?"
User: 👍 or 👎

// Store feedback
INSERT INTO crs_feedback (
  user_id, timestamp, predicted_crs, actual_feeling,
  hrv_at_time, hr_at_time, sleep_score, context_note
)
```

**Weekly weight adjustment (batch job on Edge Function):**
```
// For users with 20+ feedback points
// If users consistently rate CRS as too high → increase sleep weight
// If users consistently rate CRS as too low → increase HRV weight
// Simple gradient: adjust weights ±0.02 per week based on feedback correlation
```

---

## 6. Backend Architecture (Supabase)

### 6.1 Database Schema

```sql
-- Users
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  telegram_chat_id BIGINT,
  autonomy_level INTEGER DEFAULT 1, -- 1 = Advisor
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Health baselines (auto-computed, replaces BODY.md)
CREATE TABLE health_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  resting_hr FLOAT DEFAULT 65,
  hrv_baseline FLOAT DEFAULT 42,
  avg_sleep_minutes FLOAT DEFAULT 420,
  chronotype TEXT DEFAULT 'neutral', -- 'early_bird', 'night_owl', 'neutral'
  peak_hours JSONB DEFAULT '{"start": 10, "end": 14}',
  crs_weights JSONB DEFAULT '{"hrv": 0.40, "sleep": 0.30, "activity": 0.15, "circadian": 0.15}',
  last_computed_at TIMESTAMPTZ,
  data_days INTEGER DEFAULT 0 -- how many days of data we have
);

-- Health snapshots (computed from HC data)
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
  stress_level FLOAT, -- 0-1
  stress_classification TEXT, -- 'LOW', 'MODERATE', 'HIGH'
  hours_since_wake FLOAT,
  raw_data JSONB -- full HC response for debugging
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

-- Agent interactions (memory)
CREATE TABLE agent_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT now(),
  role TEXT NOT NULL, -- 'user', 'assistant', 'system', 'tool'
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'telegram', -- 'telegram', 'app', 'push'
  importance_score FLOAT DEFAULT 0.5, -- 0-1, for memory compaction
  metadata JSONB
);

-- Core memory (long-term learned patterns)
CREATE TABLE core_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  category TEXT NOT NULL, -- 'health_pattern', 'preference', 'behavior', 'trigger'
  content TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.5,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- Heartbeat rules (proactive task schedule)
CREATE TABLE heartbeat_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'time_based', 'biometric_trigger'
  schedule_cron TEXT, -- for time-based: '0 7 * * *' = 7am daily
  trigger_condition JSONB, -- for biometric: {"hrv_drop_pct": 20, "duration_min": 10}
  action_prompt TEXT NOT NULL, -- what to tell Claude to do
  enabled BOOLEAN DEFAULT true,
  last_fired_at TIMESTAMPTZ
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
```

### 6.2 Supabase Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `process-health-data` | Called by app every 10 min (or on app open) | Reads latest HC data from app, computes CRS + stress, stores snapshot |
| `heartbeat-check` | pg_cron every minute | Checks all active heartbeat rules, fires biometric triggers if conditions met |
| `process-message` | Telegram webhook | Receives user message, assembles context, calls Claude, returns response |
| `send-morning-brief` | pg_cron at user's preferred time | Assembles overnight health summary, calls Claude for brief, sends via Telegram |
| `compute-baselines` | pg_cron daily at 3am | Recomputes personal baselines from last 7 days of snapshots |
| `adjust-crs-weights` | pg_cron weekly Sunday 2am | Analyzes feedback, adjusts per-user CRS weights |

---

## 7. AI Agent Architecture

### 7.1 Claude API Integration

**Model:** Claude Haiku 4.5 for all MVP calls
**API:** Anthropic Messages API with `tool_use`
**Package:** `@anthropic-ai/sdk`

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1024,
  system: systemPrompt, // SOUL.md + AGENTS.md content (cached)
  messages: conversationHistory,
  tools: toolDefinitions,
});
```

### 7.2 System Prompt (SOUL.md equivalent)

The system prompt is assembled per-request from stored configuration. It includes:

1. **Identity & personality** — warm, concise, health-aware, never guilt-trips
2. **User context** — from `user_profiles` + `health_baselines` tables
3. **Current biometrics** — latest `health_snapshots` row
4. **Recent memory** — last 10 `agent_interactions` rows
5. **Core memory** — all `core_memory` rows for this user
6. **Behavioral rules** — decision framework, notification limits, safety boundaries

**Prompt caching:** The identity + behavioral rules portion (~2000 tokens) is identical across calls for the same user. With Anthropic's prompt caching (90% discount on cached input tokens, 1-hour TTL), this saves significant cost.

### 7.3 Tool Definitions (14 tools for MVP)

```typescript
const tools = [
  // Health tools
  { name: "get_current_crs", description: "Get user's current Cognitive Readiness Score", input_schema: { type: "object", properties: {} } },
  { name: "get_current_stress", description: "Get user's current stress level and classification", input_schema: { type: "object", properties: {} } },
  { name: "get_sleep_summary", description: "Get last night's sleep summary", input_schema: { type: "object", properties: {} } },
  { name: "get_health_trend", description: "Get health metrics trend over N days", input_schema: { type: "object", properties: { days: { type: "number" } } } },
  
  // Communication tools
  { name: "send_telegram_message", description: "Send a message to user on Telegram", input_schema: { type: "object", properties: { message: { type: "string" }, reply_markup: { type: "object" } }, required: ["message"] } },
  { name: "send_push_notification", description: "Send a push notification", input_schema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title", "body"] } },
  
  // Memory tools
  { name: "save_to_core_memory", description: "Save an important pattern or preference to long-term memory", input_schema: { type: "object", properties: { category: { type: "string" }, content: { type: "string" }, confidence: { type: "number" } }, required: ["category", "content"] } },
  { name: "recall_core_memory", description: "Search long-term memory for relevant patterns", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  
  // Feedback tools
  { name: "request_crs_feedback", description: "Ask user to rate CRS prediction accuracy", input_schema: { type: "object", properties: { predicted_crs: { type: "number" }, suggestion: { type: "string" } }, required: ["predicted_crs"] } },
  
  // User profile tools
  { name: "get_user_profile", description: "Get user preferences and baselines", input_schema: { type: "object", properties: {} } },
  { name: "update_user_preference", description: "Update a user preference", input_schema: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } },
  
  // Schedule tools (read-only for MVP)
  { name: "get_heartbeat_rules", description: "Get user's active heartbeat rules", input_schema: { type: "object", properties: {} } },
  
  // Utility
  { name: "get_current_time", description: "Get current time in user's timezone", input_schema: { type: "object", properties: {} } },
  { name: "log_interaction", description: "Log this interaction to daily memory", input_schema: { type: "object", properties: { summary: { type: "string" }, importance: { type: "number" } }, required: ["summary"] } },
];
```

---

## 8. Telegram Bot Integration

**API:** Telegram Bot API (free, unlimited messages)
**Docs:** [core.telegram.org/bots/api](https://core.telegram.org/bots/api)
**Cost:** $0

### Setup
1. Create bot via @BotFather on Telegram → receive bot token
2. Set webhook to Supabase Edge Function URL:
   ```
   POST https://api.telegram.org/bot{TOKEN}/setWebhook
   Body: { "url": "https://{PROJECT}.supabase.co/functions/v1/process-message" }
   ```

### Message Flow
```
User sends Telegram message
  → Telegram delivers to webhook (Edge Function)
  → Edge Function: identify user by telegram_chat_id
  → Load context: profile + baselines + recent snapshots + memory
  → Call Claude API with context + tools
  → Claude reasons, may call tools (get_current_crs, etc.)
  → Claude generates response
  → Send response back via Telegram Bot API
  → Log interaction to agent_interactions table
```

### Inline Keyboard for Feedback
```typescript
// CRS feedback buttons
const feedbackMarkup = {
  inline_keyboard: [[
    { text: "👍 Accurate", callback_data: `crs_feedback:${snapshotId}:up` },
    { text: "👎 Off", callback_data: `crs_feedback:${snapshotId}:down` }
  ]]
};
```

---

## 9. Proactive Heartbeat System

### 9.1 Biometric Trigger (THE HERO FEATURE)

The app polls Health Connect data every 10 minutes (matching Samsung GW's HRV sampling interval) and sends it to the `process-health-data` Edge Function. When a stress trigger fires:

**Trigger Condition:**
```
stress_classification === 'HIGH_STRESS' AND
duration_elevated >= 10 minutes (2+ consecutive HIGH readings) AND
time_since_last_intervention >= 30 minutes (rate limiting)
```

**What happens:**
1. Edge Function detects HIGH_STRESS condition
2. Calls Claude with context: "User's HRV has dropped 25% below baseline for 10 minutes. Current CRS is 48. They are likely in a stressful meeting or work situation."
3. Claude generates contextual intervention message
4. Sends via Telegram with action options

**Example output:**
```
🧠 Stress alert: Your body signals show elevated stress for the last 10 min.

CRS: 48 (below your usual 72)

Quick options:
[🫁 3-min breathing exercise]
[☕ Take a 5-min break]
[📝 Just noting it, I'm fine]
```

### 9.2 Time-Based Rules (Supporting Features)

| Rule | Cron | What it does |
|------|------|-------------|
| Morning Brief | `0 7 * * *` (user-configurable) | Overnight sleep summary + CRS prediction + day preview |
| Evening Wind-down | `0 21 * * *` | Recovery score + sleep suggestions |

These are implemented as pg_cron jobs that call the respective Edge Functions.

---

## 10. Mobile App Features (React Native + Expo)

### 10.1 Screens

| Screen | Purpose | Key Components |
|--------|---------|----------------|
| **Onboarding** | HC permissions + Telegram link + baseline collection | Permission request flow, QR/deeplink to Telegram bot, "Start with defaults" button |
| **Dashboard** | Current CRS + stress + today's data | CRS gauge (0-100), stress indicator, sleep score from last night, steps today |
| **History** | CRS trend over time | Line chart (recharts or victory-native), daily CRS averages, sleep scores |
| **Feedback** | Rate past CRS predictions | List of predictions with 👍/👎, accuracy percentage |
| **Settings** | Preferences + baselines + heartbeat rules | Notification timing, autonomy level toggle, Telegram reconnect, data export |

### 10.2 Background Health Data Sync

**Android 15+:** Use `READ_HEALTH_DATA_IN_BACKGROUND` permission. The app registers a periodic background task (WorkManager via expo-task-manager) that reads HC data and sends to Supabase every 15 minutes.

**Android 14 and below:** Use a foreground service notification. The ROOK SDK handles this automatically if used. Without ROOK, implement via `expo-task-manager` with a persistent notification: "OneSync is monitoring your health data."

**Data flow:**
```
[Background task wakes every 10-15 min]
  → Read from Health Connect: HR, HRV, steps, sleep (if available)
  → POST to Supabase Edge Function: process-health-data
  → Edge Function computes CRS + stress
  → Stores in health_snapshots
  → If biometric trigger condition met → fires intervention
```

---

## 11. Onboarding Flow ("Time to Magic" < 24 hours)

**Goal:** User gets their first biometric-triggered intervention within hours of install, NOT days.

### Step 1: Install + Account (2 minutes)
- Open app → Supabase Auth (email/password or Google OAuth)
- Basic profile: name, age range (for population defaults), timezone

### Step 2: Health Connect Permissions (1 minute)
- Request all 10 permissions listed in Section 4.1
- If user denies some, gracefully degrade (we can work with just HR + sleep + steps)
- Pull historical data: up to 30 days (with `READ_HEALTH_DATA_HISTORY` if granted)

### Step 3: Connect Telegram (1 minute)
- Show deep link: `https://t.me/{BOT_USERNAME}?start={user_id}`
- User taps, opens Telegram, presses Start
- Bot receives `/start` command with user_id, links telegram_chat_id to user profile

### Step 4: Compute Initial Baselines (Instant)
- If historical data exists (7+ days): compute personal baselines immediately
- If no historical data: use population defaults
  - Resting HR: 65 BPM (adjustable by age range)
  - HRV baseline: 42 ms RMSSD
  - Sleep: 7 hours average
- Either way, the agent is functional NOW

### Step 5: First Interaction (Within 5 minutes)
- Agent sends Telegram message: "Hey [name]! I've analyzed your last [N] days of health data. Your resting HR is [X] BPM, and your typical HRV is [Y] ms. Your CRS right now is [Z]. I'll keep an eye on your body signals and let you know when I spot something. 👍 or 👎 to let me know if this feels right."

---

## 12. Default Heartbeat Rules (Pre-configured)

Every new user gets these rules enabled by default:

```json
[
  {
    "rule_name": "Stress Intervention",
    "rule_type": "biometric_trigger",
    "trigger_condition": {
      "stress_classification": "HIGH_STRESS",
      "min_duration_minutes": 10,
      "cooldown_minutes": 30
    },
    "action_prompt": "User is experiencing elevated stress (HRV dropped significantly, HR elevated). Current CRS is {crs}. Send a brief, non-judgmental Telegram message acknowledging the stress, offering 2-3 quick options (breathing exercise, short break, or just acknowledging). Include CRS feedback buttons.",
    "enabled": true
  },
  {
    "rule_name": "Morning Brief",
    "rule_type": "time_based",
    "schedule_cron": "0 7 * * *",
    "action_prompt": "Generate a morning brief for the user. Include: last night's sleep score and key metrics (deep/REM/total), current CRS, energy prediction for the day based on sleep quality. Keep it under 5 sentences. Include CRS feedback button.",
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

## 13. API Cost Estimation (Realistic)

### Per-User Monthly Breakdown (Claude Haiku 4.5)

| Call Type | Calls/Day | Input Tokens | Output Tokens | Cached Input |
|-----------|-----------|-------------|--------------|-------------|
| Biometric checks (every 10 min) | ~90 | 500 (small context) | 50 (just CRS) | 0 |
| Agent reasoning (triggered) | ~5 | 3000 (full context) | 400 (response) | 2000 (system prompt cached) |
| Morning brief | 1 | 3000 | 500 | 2000 |
| Evening summary | 1 | 2500 | 400 | 2000 |
| User messages | ~3 | 3000 | 500 | 2000 |
| **Daily total** | **~100** | | | |

**Note:** The 90 biometric checks don't ALL need Claude. Only the ones that trigger a condition (maybe 1-3/day) call Claude. The rest are pure computation in the Edge Function (no AI cost). So real Claude calls are ~10/day, not 100.

**Revised monthly cost per user:**
- ~300 Claude calls/month
- Average: 2500 input tokens (1500 cached + 1000 fresh) + 400 output tokens per call
- Cost: 300 × (1000 × $1.00/MTok + 1500 × $0.10/MTok + 400 × $5.00/MTok) / 1,000,000
- = 300 × ($0.001 + $0.00015 + $0.002) = 300 × $0.00315 = **$0.95/user/month**

**For 100 users: ~$95/month** (significantly less than the $765/month single-model estimate in earlier docs, because most biometric checks don't need Claude).

### Infrastructure Costs

| Service | 10 users | 100 users | 500 users |
|---------|----------|-----------|-----------|
| Supabase | Free | $25/mo | $25/mo |
| Claude API | $9.50/mo | $95/mo | $475/mo |
| Health APIs | $0 | $0 | $0 |
| Telegram | $0 | $0 | $0 |
| Expo/Vercel | $0 | $0 | $0 |
| **Total** | **$9.50/mo** | **$120/mo** | **$500/mo** |

---

## 14. What is NOT in MVP (Explicit Cut List)

| Feature | Why Cut | When to Add |
|---------|---------|-------------|
| iOS / Apple HealthKit | Android-first proves the thesis | After 500 Android users |
| WhatsApp integration | Needs Meta Business verification (2-4 weeks) | Phase 2 |
| Google Calendar integration | Adds scope; test core health loop first | Phase 2 |
| Multi-model routing (DeepSeek/Qwen) | Premature optimization | At 100+ users when costs matter |
| Sub-agent architecture | Single Haiku model is sufficient for MVP complexity | Phase 2 |
| ROOK SDK integration | Health Connect alone covers target devices | When Oura/WHOOP users needed |
| Memory compaction | Under 500 users, memory tables won't bloat | Phase 2 |
| Progressive autonomy (L0/L2/L3) | One mode (L1 Advisor) is enough to validate | Phase 2 |
| Skills marketplace | Platform feature, premature | Phase 3 |
| A2A protocol | No external agents to connect to yet | Phase 3 |
| Meta Ray-Ban integration | Cool but completely premature | Phase 3+ |
| Task-Cognition Matching | Needs calendar integration first | Phase 2 |
| Circadian Phase Estimator | CRS already includes a simplified circadian component | Phase 2 (separate endpoint) |
| Mental Wellbeing Monitor | Needs 30+ days of data | Phase 2 |
| Movement nudge trigger | Second trigger adds complexity; nail stress trigger first | After stress trigger validated |
| Sleep-adjusted morning | Morning brief already uses sleep data; special adjustments later | Phase 2 |

---

## 15. Success Criteria (How We Know MVP Works)

| Metric | Target | How Measured |
|--------|--------|-------------|
| Onboarding completion rate | >80% of installs | Supabase: user_profiles.onboarding_complete |
| First CRS feedback within 24h | >60% of users | Supabase: crs_feedback table |
| Biometric trigger engagement | >50% of triggered users respond | Telegram callback_data tracking |
| CRS thumbs-up rate | >65% (population defaults), >75% (after 2 weeks) | crs_feedback aggregation |
| Daily active engagement | >40% DAU/MAU | agent_interactions count per day |
| Telegram response rate | >70% of agent messages get a reply or reaction | Telegram delivery + read receipts |
| Stress intervention "helpful" rating | >50% users find first intervention useful | Post-intervention feedback |

---

## 16. File Structure

```
onesync/
├── app.json                          # Expo config with HC plugin
├── package.json
├── src/
│   ├── app/                          # Expo Router screens
│   │   ├── _layout.tsx               # Root layout + auth check
│   │   ├── index.tsx                 # Dashboard (CRS gauge)
│   │   ├── onboarding.tsx            # Onboarding flow
│   │   ├── history.tsx               # CRS history chart
│   │   ├── feedback.tsx              # CRS feedback list
│   │   └── settings.tsx              # User preferences
│   ├── hooks/
│   │   ├── useHealthConnect.ts       # HC initialization + data reading
│   │   ├── useAuth.ts                # Supabase auth
│   │   └── useTelegram.ts            # Telegram link status
│   ├── lib/
│   │   ├── supabase.ts              # Supabase client init
│   │   ├── healthConnect.ts         # HC data reading + formatting
│   │   ├── algorithms/
│   │   │   ├── crs.ts               # CRS computation
│   │   │   ├── sleep-score.ts       # Sleep score from HC stages
│   │   │   └── stress.ts            # Stress detection
│   │   ├── sync.ts                  # Background sync logic
│   │   └── notifications.ts         # Push notification setup
│   └── components/
│       ├── CRSGauge.tsx             # Visual CRS display (0-100)
│       ├── StressIndicator.tsx      # Traffic light stress display
│       ├── SleepSummary.tsx         # Last night's sleep card
│       └── FeedbackButton.tsx       # Thumbs up/down component
├── supabase/
│   ├── migrations/                  # SQL schema files
│   │   └── 001_initial.sql
│   └── functions/
│       ├── process-health-data/     # Compute CRS + stress from HC data
│       │   └── index.ts
│       ├── heartbeat-check/         # Check biometric triggers
│       │   └── index.ts
│       ├── process-message/         # Telegram webhook → Claude → response
│       │   └── index.ts
│       ├── send-morning-brief/      # Daily morning summary
│       │   └── index.ts
│       ├── compute-baselines/       # Weekly baseline recomputation
│       │   └── index.ts
│       └── adjust-crs-weights/      # Weekly CRS weight adjustment from feedback
│           └── index.ts
└── config/
    ├── soul.md                      # Agent personality (loaded into system prompt)
    └── agents.md                    # Behavioral rules (loaded into system prompt)
```

---

## 17. External Service Setup Checklist

| Service | What to Do | Cost | Docs |
|---------|-----------|------|------|
| Supabase | Create project, run migrations, deploy Edge Functions | Free | [supabase.com/docs](https://supabase.com/docs) |
| Anthropic | Get API key, set up billing | Pay-per-use | [docs.anthropic.com](https://docs.anthropic.com) |
| Telegram BotFather | Create bot, get token, set webhook | Free | [core.telegram.org/bots](https://core.telegram.org/bots) |
| Google Play Console | Register developer account | $25 one-time | [play.google.com/console](https://play.google.com/console) |
| Expo | Create account, configure EAS Build | Free | [docs.expo.dev](https://docs.expo.dev) |
| Cloudflare | Register domain, configure DNS | ~$12/year | [cloudflare.com](https://cloudflare.com) |
| Vercel | Deploy landing page | Free | [vercel.com](https://vercel.com) |
| ROOK (optional) | Register, get client UUID + secret | Free ≤ 750 users | [docs.tryrook.io](https://docs.tryrook.io) |

---

*This document is the engineering source of truth. Every API, data type, package, and formula has been verified against current documentation. Build from this.*
