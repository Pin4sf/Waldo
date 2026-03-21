# OneSync -- Wearable Data Pipeline & Device Strategy

Last updated: March 15, 2026

> Every OEM deliberately locks their best health data away from Health Connect.
> This document maps exactly what you can get, from where, and how.

---

## The Core Problem

Health Connect is a lowest-common-denominator pipe. Every OEM withholds differentiated metrics:

| What OEMs show in their app | What they write to Health Connect |
|---|---|
| HRV, stress, Body Battery, readiness, respiratory rate, skin temp | Steps, HR, sleep, exercise, calories |

This is a deliberate business strategy, not a technical limitation.

---

## Top 10 Health Variables for CRS

| # | Variable | Why It Matters for CRS | HC API Data Type |
|---|----------|----------------------|-----------------|
| 1 | **Heart Rate (continuous)** | Baseline for stress & exertion detection | `HeartRateRecord` |
| 2 | **Heart Rate Variability (HRV)** | Primary autonomic nervous system indicator | `HeartRateVariabilityRmssdRecord` |
| 3 | **Sleep Stages (Light/Deep/REM)** | Cognitive restoration quality | `SleepSessionRecord (with stages)` |
| 4 | **Blood Oxygen (SpO2)** | Respiratory health, sleep apnea indicator | `OxygenSaturationRecord` |
| 5 | **Resting Heart Rate** | Long-term cardiovascular fitness trend | `RestingHeartRateRecord` |
| 6 | **Respiratory Rate** | Stress, illness early detection | `RespiratoryRateRecord` |
| 7 | **Skin Temperature** | Circadian rhythm, illness, menstrual cycle | `SkinTemperatureRecord` |
| 8 | **Steps / Active Minutes** | Daily activity & sedentary behavior | `StepsRecord` |
| 9 | **Exercise Sessions** | Workout type, duration, zones | `ExerciseSessionRecord` |
| 10 | **Calories (Total + Active)** | Energy expenditure for recovery modeling | `TotalCaloriesBurnedRecord` |

---

## Device-Specific Data Access

### Samsung Galaxy Watch -- The Full Picture

**Three Separate SDKs:**

| SDK | Runs On | Status | HRV Data |
|-----|---------|--------|----------|
| Samsung Health Data SDK | Phone | **FROZEN** (not accepting apps, 2+ years) | No raw HRV |
| **Samsung Health Sensor SDK** | Galaxy Watch (Wear OS) | **Separate program, appears active** | **Yes -- raw IBI at 1Hz** |
| Samsung Privileged Health SDK | Galaxy Watch | Restricted | Medical only (ECG/BP) |

**Sensor SDK Continuous Trackers (streaming):**

| Sensor | Frequency | Notes |
|--------|-----------|-------|
| Accelerometer (raw X/Y/Z) | 25 Hz | |
| PPG (Green, IR, Red LED) | 25 Hz | Raw photoplethysmogram |
| Heart Rate + IBI | 1 Hz | Up to 4 IBI values per reading -- compute HRV yourself |
| Skin Temperature | varies | Galaxy Watch 5+ |
| EDA | 1 Hz | Galaxy Watch 8+ only |

**On-Demand Trackers:** ECG (500 Hz), SpO2, BIA/MF-BIA, Sweat Loss

**Developer Mode (No Approval Needed):**
1. On Galaxy Watch: Settings > Apps > Health Platform
2. Tap "Health Platform" title ~10 times
3. "[Dev mode]" appears -- full sensor access unlocked
4. Distribution requires partner approval (separate from frozen Data SDK)

**Watch-to-Phone Architecture:**
- Watch app uses Sensor SDK (`HealthTracker` + `TrackerEventListener`)
- Data sent via Wearable Data Layer API (`MessageClient.sendMessage()`)
- Phone companion app receives via `DataListenerService`

**Supported Devices:** Galaxy Watch 4, 4 Classic, 5, 5 Pro, 6, 6 Classic, 7, Ultra, FE, 8+

**What Samsung Writes to HC:** Steps, HR (delayed), sleep stages, exercise, SpO2 (manual), body composition, BP, blood glucose, calories, weight, height, BMR

**NOT Written (gap):** HRV, resting HR, respiratory rate, skin temperature, stress score, energy score

### Garmin -- Fully Open, Best Developer Story

**No partnership or approval needed.** Fully open to all developers.

**Real-Time Sensor Data (`Toybox.Sensor`, 1Hz):**

| Field | Unit |
|-------|------|
| heartRate | bpm |
| oxygenSaturation | % (SpO2) |
| temperature | degrees C |
| accel [x,y,z] | milli-G |

**High-Frequency Data (`registerSensorDataListener()`, up to 25-100Hz):**

| Data | Details |
|------|---------|
| `accelerometerData` | x, y, z arrays, configurable Hz |
| `gyroscopeData` | x, y, z rotation (API 3.3.0+) |
| `magnetometerData` | x, y, z (API 3.3.0+) |
| **`heartRateData.heartBeatIntervals`** | **Raw IBI in milliseconds -- THIS IS YOUR HRV DATA** |

**Historical Data (`Toybox.SensorHistory`):** Heart rate, SpO2, temperature, stress (0-100), Body Battery (0-100)

**Watch-to-Phone:** `Communications.transmit()` -> Connect IQ Mobile SDK (Android: Maven `connectiq-android-sdk`)

**Limitation:** IBI via `registerSensorDataListener()` requires foreground app. SensorHistory works without foreground.

**What Garmin Locks from HC:** Body Battery, HRV, stress scores, Training Load, Training Effect, Training Readiness, Endurance Score, VO2 Max, respiration rate

### Fitbit / Pixel Watch -- Cloud API Only for HRV

- Sense 2 and Versa 4: clock faces ONLY, no third-party apps
- Pixel Watch uses Fitbit health engine but does NOT expose Fitbit-level data through Wear OS APIs
- **Fitbit Web API** is the only path: 5-minute RMSSD windows during sleep, HR (1-min intraday), SpO2, skin temp, breathing rate, sleep stages
- Fitbit does NOT write HRV to Health Connect

### WHOOP -- Cloud API Only, Daily Summaries

- No on-device SDK. Only BLE Heart Rate Broadcast (live HR only, no HRV)
- **WHOOP Developer API v2:** recovery_score, resting_heart_rate, hrv_rmssd_milli (ONE value per day), spo2, skin_temp, sleep stages, respiratory_rate
- No real-time API. All data is post-processed. Webhooks notify when scored.

### Oura Ring -- Best Cloud API, 5-Min HR Time Series

- No BLE SDK. All access through cloud REST API v2
- **Heart Rate:** 5-minute interval time series, all day and night
- **Sleep:** Stages, average_hrv (nightly RMSSD), average_heart_rate, lowest_heart_rate, average_breath, efficiency
- **Readiness:** Score (0-100) with contributors
- Oura actually writes HRV to HC (better than most)
- Requires active Oura Membership for API access

### Other Devices

| Device | SDK/Access | HRV | Notes |
|--------|-----------|-----|-------|
| OnePlus Watch 2/2R | Standard Wear OS + HC | No | OHealth writes HR/sleep/steps to HC; HRV sync broken/missing (confirmed multiple user reports) |
| Amazfit / Zepp OS | JS SDK: HR, SpO2, stress (no raw IBI) | **Partial** | 2024+ firmware update adds HRV sync to HC on newer models (GTR 4, GTS 4, Active 2); older models HC only |
| Xiaomi | No public SDK | No | Mi Fitness writes HR, SpO2, steps, sleep to HC; HRV not synced |
| CMF Watch Pro 2 | No SDK (proprietary RTOS) | No | HC: HR, SpO2, stress, sleep, steps |
| Google Pixel Watch | Wear OS + HC | **Partial** | Writes sleep HRV to HC; no real-time RMSSD; Wear OS Health Services blocks raw RR intervals for 3rd parties |

---

## The Complete Data Matrix

### Tier 1: On-Watch Apps with Raw IBI/HRV (Real-Time)

| Device | SDK | IBI | SpO2 | Skin Temp | Phone Comms | Language | Approval |
|--------|-----|-----|------|-----------|-------------|----------|----------|
| Samsung GW 4-8 | Health Sensor SDK | 1Hz continuous | On-demand | Yes (GW5+) | Wearable Data Layer | Kotlin | Dev mode: none |
| Garmin (all modern) | Connect IQ SDK | IBI array in ms | History | History | Communications.transmit() | Monkey C | **None** |

### Tier 2: Cloud API Only (Delayed, Post-Sync)

| Device | API | HRV | Granularity | SpO2 | Real-Time |
|--------|-----|-----|-------------|------|-----------|
| Oura Ring | REST API v2 | Nightly avg RMSSD | 5-min HR all day | Yes | No |
| WHOOP | REST API v2 | Daily RMSSD | 1 value/day | Yes (4.0+) | BLE HR only |
| Fitbit | Web API | 5-min RMSSD (sleep) | Sleep windows only | Nightly avg | No |

### Tier 3: Health Connect Only (Basic, Universal)

| Device | HR | HRV | SpO2 | Sleep Stages |
|--------|-----|-----|------|-------------|
| OnePlus Watch 2 | Yes | No | No | Partial |
| Pixel Watch | Yes | No | No | Yes |
| Xiaomi | Yes | No | Yes (some) | Basic |
| CMF Watch Pro 2 | Yes | No | No | Basic |
| Amazfit | Yes | No | Yes (some) | Yes |

---

## Health Connect Data Availability Matrix

| Variable | Samsung GW | Pixel Watch | Fitbit | Garmin | WHOOP | Oura | OnePlus | Amazfit |
|----------|-----------|------------|--------|--------|-------|------|---------|---------|
| **Heart Rate** | Yes | Yes | Yes | Yes | No* | No* | Yes | Yes |
| **HRV** | Partial | Yes | Partial | Locked | No* | No* | No | Partial |
| **Sleep Stages** | Yes | Yes | Yes | Partial | No* | No* | Partial | Yes |
| **SpO2** | Partial | Yes | Partial | Locked | No* | No* | No | Partial |
| **Resting HR** | Partial | Yes | Yes | Yes | No* | No* | Partial | Yes |
| **Respiratory Rate** | Partial | Yes | Partial | Locked | No* | No* | No | No |
| **Skin Temperature** | Yes | Yes | No | Locked | No* | No* | No | No |
| **Steps** | Yes | Yes | Yes | Yes | No* | No* | Yes | Yes |

*No HC support -- own API only

**Key findings:** Pixel Watch has best HC coverage. Samsung writes basics but locks HRV/SpO2/respiratory. Garmin deliberately locks premium metrics. WHOOP & Oura don't use HC at all.

---

## How Aggregators (Terra, ROOK) Get Data

They do NOT build on-watch apps. Three paths:
1. **Privileged OEM partnerships** (Samsung): Business-level agreements, gets processed metrics, NOT raw IBI
2. **Cloud-to-cloud APIs** (Garmin, Fitbit, WHOOP, Oura): Same OAuth REST APIs you'd use
3. **Health Connect fallback**: Same limited data everyone gets

**Your on-watch approach gives RICHER, FASTER data than any aggregator.**

---

## Why You Don't Need Terra API ($399/mo)

| Factor | Terra API | Our Stack (HC + Direct SDKs) |
|--------|----------|------------------------------|
| Monthly Cost | $399-499/mo | $0 |
| Device Coverage | 200+ devices | 10 premium (covers 95% of target users) |
| Data Completeness | ~95% | ~96% (with direct SDKs) |
| Dependency | Full dependency | You own the integrations |
| Latency | Cloud round-trip | On-device + direct API |
| Long-term Cost | Grows with users | Flat $0 |

---

## OneSync Connector Architecture

```
Samsung Watch --[Sensor SDK]--> Phone (Wearable Data Layer) --> Supabase
Garmin Watch --[Connect IQ]--> Phone (CIQ Mobile SDK) --> Supabase
Oura Ring --[Cloud API]--> Supabase Edge Function --> Supabase
WHOOP --[Cloud API]--> Supabase Edge Function --> Supabase
Fitbit --[Web API]--> Supabase Edge Function --> Supabase
Everything else --[Health Connect]--> Phone (native Kotlin module) --> Supabase
```

### Build Priority

| Priority | Device | Connector Type | Effort |
|----------|--------|---------------|--------|
| P0 | Samsung Galaxy Watch 6/7 | Watch companion (Kotlin) + HC fallback | 2-3 weeks |
| P0 | Health Connect (universal) | Native Kotlin module (not community bridge) | 1 week |
| P1 | Garmin | Connect IQ watch app (Monkey C) + Android companion | 2 weeks |
| P1 | Oura Ring | REST API client in Edge Functions | 1 week |
| P2 | Fitbit | REST API client (OAuth2) | 1 week |
| P2 | WHOOP | REST API client (OAuth2) | 1 week |
| P3 | Apple Watch | iOS app + HealthKit SDK | 3-4 weeks |

---

## Developer Registrations & API Access Checklist

### Priority Order (longest approval first)

| # | Platform | Approval Time | Cost | MVP Needed? |
|---|----------|---------------|------|-------------|
| 1 | Google Play Console | 48h - 2 weeks (ID verification) | $25 one-time | Yes |
| 2 | Meta Business (WhatsApp) | Sandbox: instant. Business: 3-14 days | Free | Optional |
| 3 | Samsung Developer Account | Instant | Free | Yes |
| 4 | Samsung Health Sensor SDK | Instant (dev mode) | Free | Yes |
| 5 | Garmin Connect IQ SDK | Instant | Free | Phase 2 |
| 6 | Fitbit Web API | Instant (personal app) | Free | Phase 2 |
| 7 | Oura Developer Portal | Instant (personal token) | Free (needs ring) | Phase 3 |
| 8 | WHOOP Developer Dashboard | Instant (dev mode, 10 users) | Free (needs device) | Phase 3 |
| 9 | Anthropic API | Instant | Pay-per-use | Yes |
| 10 | Supabase | Instant | Free tier | Yes |
| 11 | Expo | Instant | Free (15 builds/mo) | Yes |
| 12 | Telegram Bot (@BotFather) | Instant | Free forever | Yes |

### Documents Needed

**Google Play Console:** Government-issued photo ID, physical address. Register as personal (not organization).

**Meta Business (WhatsApp):** GST certificate, business registration, or utility bill. Legal name must exactly match Business Manager entry.

**Google OAuth (Calendar/Gmail):** Testing mode: up to 100 test users, no review. Production review: 1-3 weeks.

### Samsung Health SDK Important Notes

- **Data SDK (Phone-side): PARTNERSHIP FROZEN** -- closed 2+ years, no reopening date
- **Sensor SDK (Watch-side): SEPARATE PROGRAM** -- appears to still accept applications
- Developer Mode available immediately on your own device

### NOT Needed for MVP

| Platform | Why Not | When |
|----------|---------|------|
| ROOK SDK | No free tier needed, $399/mo | When >750 users |
| Terra API | $399/mo, no free tier | Not needed |
| Apple Developer | $99/yr, iOS is Phase 2+ | When starting iOS |
| WHOOP/Oura APIs | Need respective devices | When supporting those users |

---

## Data Completeness: HC Only vs Our Stack

| Variable | HC Only | HC + Direct SDKs |
|----------|---------|------------------|
| Heart Rate | 8/8 devices | 10/10 devices |
| HRV | 2/8 devices | 10/10 devices |
| Sleep Stages | 5/8 devices | 10/10 devices |
| SpO2 | 2/8 devices | 9/10 devices |
| Resting HR | 5/8 devices | 10/10 devices |
| Respiratory Rate | 2/8 devices | 8/10 devices |
| Skin Temperature | 2/8 devices | 7/10 devices |
| **Overall Coverage** | **~55%** | **~96%** |

---

## NOTES & RECOMMENDATIONS

### 1. Samsung Sensor SDK is the Biggest Early Risk
The Sensor SDK partner program status is unclear. If distribution approval is blocked, your P0 device has no raw IBI. Mitigation: apply for partnership in Week 1, build in dev mode, prepare Garmin as fallback for public beta.

### 2. Indian Market Reality
The top 3 wearable brands in India (Noise, boAt, Fire-Boltt) are HC-only Tier 3 devices with no HRV support. OneSync's premium features (stress detection, real-time CRS) only work with Tier 1/2 devices. Consider: target Samsung Galaxy Watch + Garmin users explicitly in marketing. The mass Indian market is HC-only basic data.

### 3. BLE Direct Connection as Future Path
For devices without SDKs, direct BLE communication is possible (many budget wearables use standard BLE HR profile). This is a Phase 3+ effort but could unlock Noise/boAt devices at the raw sensor level.

### 4. Oura as Quick Win
Oura's API is the cleanest and richest cloud API. It writes HRV to HC (unique among cloud-API devices). Oura users are high-intent health enthusiasts -- perfect target. Consider bumping Oura integration to P1.

### 5. Health Connect Permission Strategy
Request permissions one-by-one, not all at once. Order: Sleep -> Heart Rate -> Steps -> Exercise -> SpO2. Permission denial is permanent after 2 declines on Android -- the pre-permission education screen is critical.

### 6. Data Freshness vs Completeness Tradeoff
Tier 1 (on-watch) gives real-time data but requires companion app development. Tier 2 (cloud API) gives richer processed data but with hours of delay. For stress detection (real-time need), only Tier 1 works. For morning briefings (overnight data), Tier 2 is sufficient and richer.

### 7. Watch Battery Impact
Continuous IBI streaming at 1Hz from Samsung Sensor SDK impacts watch battery. Consider: stream IBI only during "active monitoring" windows (work hours), switch to HC-based periodic reads at night. User-configurable monitoring intensity.

---

## Global Device Coverage Map (Full Product)

> Updated March 15, 2026. This section answers: "Can we support the top 10 wearables properly at launch?"

### Global Market Share (2025)

| Rank | Brand | Global Share | Key Devices |
|------|-------|-------------|-------------|
| 1 | Apple | ~25% | Watch Series 10, Ultra 2, SE |
| 2 | Huawei | ~17% | Watch GT 5, Watch 4 |
| 3 | Xiaomi | ~10% | Smart Band 9, Watch 2 |
| 4 | Samsung | ~15% | Galaxy Watch 7, 6, FE |
| 5 | Garmin | ~8% | Forerunner, Fenix, Venu |
| 6 | Fitbit/Google | ~5% | Versa 4, Sense 2, Charge 6 |
| 7 | Amazfit | ~5% | GTR 4, GTS 4, Active 2 |
| 8 | OnePlus/OPPO | ~3% | Watch 2, Watch 2R |
| 9 | WHOOP | ~2% | WHOOP 4.0, 5.0 |
| 10 | Oura | ~2% | Ring Gen 3, Gen 4 |

### Per-Device HRV & CRS Support

| Device | CRS Quality | Stress Detection | Data Path | Phase |
|--------|-------------|-----------------|-----------|-------|
| **Samsung GW 6/7** | **Full — RMSSD real-time** | **Yes** | Health Connect + Sensor SDK (raw IBI) | Phase 1 |
| **Garmin (all modern)** | **Full — raw IBI via Connect IQ** | **Yes** | Connect IQ watch app + Garmin Cloud API | Phase 2 |
| **Oura Ring** | **Full — 5-min sleep RMSSD** | Sleep-based only | Oura API v2 | Phase 2 |
| **WHOOP 4.0/5.0** | **Good — daily RMSSD** | Recovery-based | WHOOP Developer API v2 | Phase 2 |
| **Fitbit Versa 4 / Sense 2** | **Good — 5-min sleep RMSSD** | Sleep-based only | Fitbit Web API (intraday) | Phase 2 |
| **Google Pixel Watch 2/3** | **Moderate — sleep HRV via HC** | Limited | Health Connect | Phase 1 |
| **Apple Watch (all)** | **Good — SDNN (requires algo variant)** | Yes (formula adaptation) | iOS HealthKit | Phase 3 |
| **Amazfit (GTR 4, newer)** | **Moderate — HC HRV improving** | Limited | Health Connect (improving 2024+) | Phase 1–2 |
| **Huawei Watch GT 5 / Watch 4** | **Moderate — processed HRV** | Limited | Huawei Health Kit (HMS) | Phase 3–4 |
| **Xiaomi Mi Band / Smart Band** | **Degraded — no HRV any path** | HR-only | Health Connect (HR + sleep + steps) | Phase 1 (basic) |
| **OnePlus Watch 2/2R** | **Degraded — no HRV any path** | HR-only | Health Connect (OHealth → HC HRV broken) | Phase 1 (basic) |

### Key Technical Constraints Per Device

**Apple Watch (25% of market — critical for Phase 3):**
- Data available via HealthKit: SDNN (not RMSSD), sleep stages, HR, SpO2, ECG
- Apple uses SDNN standard; CRS formula needs a parallel `crs_sdnn()` variant for iOS users
- Raw RR intervals blocked to all third-party apps — not a workaround problem, architectural wall
- Requires full iOS app + HealthKit integration (separate codebase)

**Huawei (17% global — but ~3–5% India post-2020):**
- Runs HMS (Huawei Mobile Services), not GMS — completely separate SDK ecosystem
- Huawei Health Kit API available in most countries, but requires separate HMS build
- Low priority for India-first launch

**Xiaomi & OnePlus (no HRV path exists):**
- No public SDK from either brand
- Wear OS Health Services does not expose raw RR intervals to third parties (confirmed)
- Cannot get RMSSD through any developer-accessible path
- Support with degraded "Basic CRS" (sleep + activity + circadian only)
- Use as natural upsell: "Upgrade to Samsung Galaxy Watch for full Stress Detection"

**Garmin (open & excellent data, Phase 2):**
- Connect IQ watch app (Monkey C) streams raw IBI arrays — clinical quality
- Garmin Connect Cloud REST API gives daily HRV + sleep (quick Phase 2 OAuth integration)
- Does NOT write HRV to Health Connect — must use one of the two paths above
- Garmin users are high-intent health trackers = ideal OneSync target audience

### Data Architecture by Pipeline

```
Pipeline 1: Health Connect (Android — Phase 1)
  Covers: Samsung GW, Pixel Watch, Amazfit, OnePlus, Xiaomi
  HRV: Samsung/Pixel only; others get HR + sleep

Pipeline 2: Cloud REST APIs (Phase 2)
  Covers: Fitbit, WHOOP, Oura, Garmin Connect
  HRV: All — daily/sleep RMSSD
  Implementation: Supabase Edge Functions + OAuth cron sync

Pipeline 3: Watch SDK Companions (Phase 2)
  Covers: Samsung (Sensor SDK, raw IBI), Garmin (Connect IQ, raw IBI)
  HRV: Real-time RMSSD — best quality
  Implementation: Kotlin companion (Samsung) + Monkey C watch app (Garmin)

Pipeline 4: iOS HealthKit (Phase 3)
  Covers: Apple Watch (25% of global market)
  HRV: SDNN — needs CRS formula variant
  Implementation: React Native iOS app + HealthKit bridge
```

### Market Coverage by Phase

| Phase | Wearables Covered | Est. Global User Reach | HRV Quality |
|-------|------------------|----------------------|-------------|
| Phase 1 (MVP) | Samsung GW, Pixel Watch, Amazfit, basic HC devices | ~25–30% Android wearables | Full for Samsung; degraded for others |
| Phase 2 | + Garmin, Oura, WHOOP, Fitbit, Samsung raw IBI | ~55–60% of global wearables | Full for all premium devices |
| Phase 3 | + Apple Watch (iOS) | ~80–85% of global wearables | Full (SDNN variant) |
| Phase 4 | + Huawei Health Kit | ~95%+ | Processed HRV |

### The Key Insight
> The users willing to pay for OneSync are overwhelmingly the same users who own premium wearables — Samsung, Garmin, Oura, WHOOP. That segment has excellent HRV data paths available today. Xiaomi/OnePlus budget users are not the target customer. Phase 1 already covers your paying audience; Phase 2 completes it; Phase 3 (iOS) is the single biggest market unlock.
