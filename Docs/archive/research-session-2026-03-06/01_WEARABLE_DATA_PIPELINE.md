# OneSync — Wearable Data Pipeline (Complete Research)

> Every OEM deliberately locks their best health data away from Health Connect.
> This document maps exactly what you can get, from where, and how.

Last updated: March 6, 2026

---

## The Core Problem

Health Connect is a lowest-common-denominator pipe. Every OEM withholds differentiated metrics:

| What OEMs show in their app | What they write to Health Connect |
|---|---|
| HRV, stress, Body Battery, readiness, respiratory rate, skin temp | Steps, HR, sleep, exercise, calories |

This is a deliberate business strategy, not a technical limitation.

---

## Samsung Galaxy Watch — The Full Picture

### Three Separate SDKs

| SDK | Runs On | Partnership Status | HRV Data |
|-----|---------|-------------------|----------|
| Samsung Health Data SDK | Phone | **FROZEN** (not accepting applications, 2+ years) | No raw HRV anyway |
| **Samsung Health Sensor SDK** | Galaxy Watch (Wear OS) | **Separate program, appears active** | **Yes — raw IBI at 1Hz** |
| Samsung Privileged Health SDK | Galaxy Watch | Restricted | Medical only (ECG/BP) |

### Samsung Health Sensor SDK — What You Get

**Continuous Trackers (streaming):**

| Sensor | Frequency | Notes |
|--------|-----------|-------|
| Accelerometer (raw X/Y/Z) | 25 Hz | |
| PPG (Green, IR, Red LED) | 25 Hz | Raw photoplethysmogram |
| Heart Rate + IBI | 1 Hz | Up to 4 IBI values per reading — compute HRV yourself |
| Skin Temperature | varies | Galaxy Watch 5+ |
| EDA | 1 Hz | Galaxy Watch 8+ only |

**On-Demand Trackers:**

| Sensor | Notes |
|--------|-------|
| ECG | 500 Hz raw electrocardiogram |
| SpO2 | Blood oxygen level |
| BIA / MF-BIA | Body composition |
| Sweat Loss | Post-running |

### Developer Mode (No Approval Needed)

1. On Galaxy Watch: Settings > Apps > Health Platform
2. Tap "Health Platform" title ~10 times
3. "[Dev mode]" appears — full sensor access unlocked
4. Works for development/testing. Distribution requires partner approval (separate from frozen Data SDK program)

### Watch-to-Phone Architecture

Samsung has an official tutorial for this exact pattern:
- Watch app uses Sensor SDK (`HealthTracker` + `TrackerEventListener`)
- Data sent via Wearable Data Layer API (`MessageClient.sendMessage()`)
- Phone companion app receives via `DataListenerService`
- Reference: developer.samsung.com/health/blog/en/transfer-heart-rate-from-galaxy-watch-to-a-phone

### Supported Devices

Galaxy Watch 4, 4 Classic, 5, 5 Pro, 6, 6 Classic, 7, Ultra, FE, 8+ (all Watch4 and later)

### What Samsung Writes to Health Connect vs What It Blocks

**Written to HC:** Steps, HR (delayed), sleep stages, exercise, SpO2 (manual), body composition, BP, blood glucose, calories, weight, height, BMR

**NOT written (complete gap):** HRV, resting HR, respiratory rate, skin temperature, stress score, energy score

### SDK Download

- SDK v1.4.1 (70.8 KB AAR): developer.samsung.com/health/sensor/overview.html
- Dev mode guide: developer.samsung.com/health/sensor/guide/developer-mode.html
- Data specs: developer.samsung.com/health/sensor/guide/data-specifications.html

---

## Garmin — Fully Open, Best Developer Story

### Connect IQ SDK (On-Watch Apps)

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
| **`heartRateData.heartBeatIntervals`** | **Raw IBI in milliseconds — THIS IS YOUR HRV DATA** |

**Historical Data (`Toybox.SensorHistory`):**

| Method | Unit |
|--------|------|
| getHeartRateHistory() | bpm |
| getOxygenSaturationHistory() | % |
| getTemperatureHistory() | degrees C |
| getStressHistory() | 0-100 |
| getBodyBatteryHistory() | 0-100 |

**Watch-to-Phone Communication:**
- `Communications.transmit()` sends data to phone
- Phone receives via Connect IQ Mobile SDK (Android: Maven `connectiq-android-sdk`)
- Near-real-time streaming viable

**Limitation:** IBI via `registerSensorDataListener()` requires foreground app. SensorHistory works without foreground.

**What Garmin Locks from Health Connect:** Body Battery, HRV, stress scores, Training Load, Training Effect, Training Readiness, Endurance Score, VO2 Max, respiration rate

### Key Links

- SDK: developer.garmin.com/connect-iq/sdk/
- Sensor API: developer.garmin.com/connect-iq/api-docs/Toybox/Sensor.html
- SensorHistory: developer.garmin.com/connect-iq/api-docs/Toybox/SensorHistory.html
- HeartRateData (IBI): developer.garmin.com/connect-iq/api-docs/Toybox/Sensor/HeartRateData.html
- Android SDK: github.com/garmin/connectiq-android-sdk
- Compatible devices: developer.garmin.com/connect-iq/compatible-devices/
- Language: Monkey C

---

## Fitbit / Pixel Watch — Cloud API Only for HRV

### On-Device SDK: Dead End

- Sense 2 and Versa 4: clock faces ONLY, no third-party apps
- On-device SDK exposes: accelerometer, gyro, HR. Does NOT expose: HRV, SpO2, skin temp, EDA, IBI
- Google confirmed no more Fitbit OS smartwatches. Pixel Watch (Wear OS) replaces them.
- Pixel Watch uses Fitbit health engine but does NOT expose Fitbit-level data through Wear OS APIs

### Fitbit Web API (Cloud REST) — The Only Path for HRV

**HRV Intraday Endpoints:**
- `GET /1/user/-/hrv/date/{date}/all.json` — 5-minute RMSSD windows during sleep
- Fields: `rmssd`, `coverage`, `hf` (high frequency), `lf` (low frequency)
- Sleep-only. Not 24/7. Requires intraday access approval for multi-user apps.
- Personal apps get instant access (your own data only)

**Other Data:** HR (1-min intraday), SpO2 (nightly avg), skin temp (relative), breathing rate, sleep stages

**Fitbit does NOT write HRV to Health Connect.** Same problem as Samsung.

### Key Links

- Register app: dev.fitbit.com/apps
- HRV API: dev.fitbit.com/build/reference/web-api/heartrate-variability/
- HRV intraday: dev.fitbit.com/build/reference/web-api/intraday/get-hrv-intraday-by-date/

---

## WHOOP — Cloud API Only, Daily Summaries

### No On-Device SDK

Only BLE Heart Rate Broadcast (standard BLE HR profile, live HR only, no HRV).

### WHOOP Developer API v2

**Recovery (daily, upon waking):**
- `recovery_score` (0-100)
- `resting_heart_rate` (bpm)
- `hrv_rmssd_milli` (HRV in ms, RMSSD) — **ONE value per day**
- `spo2_percentage` (WHOOP 4.0+)
- `skin_temp_celsius` (WHOOP 4.0+)

**Sleep:**
- Light/deep/REM/awake durations
- `respiratory_rate`, efficiency, disturbance count

**No real-time API.** All data is post-processed summaries. Webhooks notify when new data is scored.

**Health Connect writes:** Workout HR, sleep sessions (not stages), SpO2, RHR. Does NOT write HRV.

### Key Links

- Dashboard: developer-dashboard.whoop.com
- API docs: developer.whoop.com/api/
- Dev mode: instant, up to 10 users. Requires WHOOP device + membership.

---

## Oura Ring — Best Cloud API, 5-Min HR Time Series

### No BLE SDK

Ring syncs to Oura app via proprietary BLE. All access through cloud REST API.

### Oura API v2

**Heart Rate:** 5-minute interval time series, all day and night. Genuine time-series, not just daily summary.

**Sleep:** Stages (REM/deep/light/awake), `average_hrv` (nightly RMSSD), `average_heart_rate`, `lowest_heart_rate`, `average_breath`, efficiency

**Readiness:** Score (0-100) with contributors: activity_balance, body_temperature, hrv_balance, previous_night, recovery_index, resting_hr, sleep_balance

**Also:** Daily stress, SpO2, VO2 Max, cardiovascular age, resilience

**Health Connect writes:** Sleep stages, HR, HRV, workouts, steps, active calories. Better than most — Oura actually writes HRV to HC.

**Requires active Oura Membership for API access.**

### Key Links

- API docs: cloud.ouraring.com/v2/docs
- Auth: cloud.ouraring.com/docs/authentication
- Personal token: instant. OAuth app: instant for <=10 users.

---

## Other Devices

### OnePlus Watch 2 (Wear OS)

- Standard Wear OS Health Services API: HR only (no HRV, no SpO2 via standard API)
- No proprietary sensor SDK
- Health Connect via Wear OS pipeline: HR, steps, sleep, exercise
- Can build Wear OS companion apps but limited to standard APIs

### Amazfit / Zepp OS

- Zepp OS Mini Programs SDK (JavaScript): HR (per-minute), SpO2 (on-demand), stress score (per-minute, but no raw HRV), accelerometer, gyro
- No raw IBI/beat-to-beat intervals
- Health Connect: 26 data types via Zepp app
- SDK docs: docs.zepp.com/docs/intro/

### Xiaomi

- No public developer SDK (except Mi Band 7 via Zepp OS)
- Mi Fitness app writes to Health Connect: HR, SpO2, sleep stages, steps, calories, resting HR
- No official API

### CMF Watch Pro 2 (Nothing)

- No developer SDK (proprietary RTOS)
- CMF Watch app syncs to Health Connect: HR, SpO2, stress, sleep, steps
- Use as "worst case" test device for HC-only path

---

## The Complete Data Matrix

### Tier 1: On-Watch Apps with Raw IBI/HRV (Real-Time)

| Device | SDK | IBI | SpO2 | Skin Temp | Stress | Phone Comms | Language | Approval |
|--------|-----|-----|------|-----------|--------|-------------|----------|----------|
| Samsung GW 4-8 | Health Sensor SDK | 1Hz continuous | On-demand | Yes (GW5+) | Compute yourself | Wearable Data Layer | Kotlin | Dev mode: none |
| Garmin (all modern) | Connect IQ SDK | IBI array in ms | History | History | 0-100 history | Communications.transmit() | Monkey C | **None** |

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

## How Aggregators (Terra, ROOK) Actually Get Data

They do NOT build on-watch apps. Three paths:

1. **Privileged OEM partnerships** (Samsung): Business-level SDK agreements signed when program was open. Gets processed metrics, NOT raw IBI.
2. **Cloud-to-cloud APIs** (Garmin, Fitbit, WHOOP, Oura): Same OAuth REST APIs you'd use. No magic.
3. **Health Connect fallback**: Same limited data everyone gets.

**Your on-watch approach gives RICHER, FASTER data than any aggregator.** They get processed summaries; you get raw sensor streams.

---

## OneSync Connector Architecture

```
Samsung Watch ──[Sensor SDK]──> Phone (Wearable Data Layer) ──> Supabase
Garmin Watch ──[Connect IQ]──> Phone (CIQ Mobile SDK) ──> Supabase
Oura Ring ──[Cloud API]──> Supabase Edge Function ──> Supabase
WHOOP ──[Cloud API]──> Supabase Edge Function ──> Supabase
Fitbit ──[Web API]──> Supabase Edge Function ──> Supabase
Everything else ──[Health Connect]──> Phone (react-native-health-connect) ──> Supabase
```

### Build Priority

| Priority | Device | Connector Type | Effort |
|----------|--------|---------------|--------|
| P0 | Samsung Galaxy Watch 6/7 | Watch companion (Kotlin) + HC fallback | 2-3 weeks |
| P0 | Health Connect (universal) | react-native-health-connect | 1 week |
| P1 | Garmin | Connect IQ watch app (Monkey C) + Android companion | 2 weeks |
| P1 | Oura Ring | REST API client in Edge Functions | 1 week |
| P2 | Fitbit | REST API client (OAuth2) | 1 week |
| P2 | WHOOP | REST API client (OAuth2) | 1 week |
| P3 | Apple Watch | iOS app + HealthKit SDK | 3-4 weeks |
