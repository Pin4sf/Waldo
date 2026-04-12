# Form Score — Consolidated Calculation Reference
### (Internal name: Cognitive Readiness Score / CRS)

*Consolidated from: CRS_for_Waldo_OneSync.docx + waldo_data_architecture.html*
*April 2026*

---

## Naming Convention

Both documents describe the same underlying system. The names differ because one is the calculation spec and one is the product-facing architecture. This document uses both names side by side throughout.

| Calculation Name (internal) | Product Name (user-facing) | Scope |
|---|---|---|
| CRS — Cognitive Readiness Score | **Form** | The headline 0–100 number |
| Recovery Score | **Sleep score** | Pillar 1 / Tier 2 component |
| CASS — Current Autonomic State Score | **Stress confidence** (internal only, never shown raw) | Pillar 2 / feeds Form |
| ILAS — Inverse Load Accumulation Score | **Load** | Pillar 3 / Tier 1 (0–21 scale) |
| Circadian Disruption Penalty (CDP) | **Circadian score** | Sub-component of ILAS / Tier 2 |
| Daylight Adequacy Score (DAS) | Surfaced via **The Spots** | Sub-component of ILAS |
| Morning Wag | **The Brief** | Daily morning message |
| Fetch Alert | **The Fetch** | Intraday stress alert |
| The Adjustment | **The Patrol / The Handoff** | Agent action log |

> **Note on Load:** In the CRS doc, ILAS is a pillar inside the CRS calculation (0–100, inverse). In the architecture doc, Load is a separate Tier 1 metric (0–21, log-scaled from TRIMP). These are related but not identical — ILAS feeds the Form calculation while Load is a standalone user-visible number. Both are derived from physical effort data. See Section 3 for details.

---

## The Full Formula Stack

```
FORM (0–100)
= (Sleep score × 0.35) + (HRV score × 0.25) + (Circadian score × 0.25) + (Motion score × 0.15)
↑ This is the architecture doc's composition of Form from its four Tier 2 components

CRS (0–100) — calculation engine underneath Form
= (Recovery Score × 0.50) + (CASS × 0.35) + (ILAS × 0.15)
↑ This is the CRS doc's three-pillar formula
```

**How they reconcile:** The architecture doc breaks Form into 4 visible components (Sleep score, HRV, Circadian, Motion). The CRS doc shows the deeper three-pillar math underneath. Recovery Score maps primarily to Sleep score. CASS maps to HRV score + Resting HR. ILAS maps to Circadian score + Motion + Load combined. The CRS formula is the engine; the Form breakdown is the user-facing display.

---

## Architecture Overview

```
TIER 3 — Raw Signals          TIER 2 — Computed Metrics       TIER 1 — User-Facing
(from Apple Watch)             (internal calculations)          (what user sees)
──────────────────────────────────────────────────────────────────────────────────

HRV (RMSSD) ──────────────→  HRV score (CASS: 60%)  ──┐
Sleep duration ────────────→  Sleep score (RS: 50%)  ──┤
Deep sleep % ──────────────→  Sleep Debt             ──┤→  FORM / CRS (0–100)
REM % ─────────────────────→  Circadian score        ──┤   = The Brief headline
Sleep efficiency ──────────→  Motion score           ──┘
Bedtime ───────────────────→  (above feeds Form)
Heart rate (continuous) ───→  Resting HR (RHRTS: 25%) ─→  Stress confidence ──→ The Fetch
Steps ─────────────────────→  Motion score           ──→  Form
Exercise mins ─────────────→  Load (0–21, TRIMP)     ──→  Today's Weight
Stand hours ───────────────→  Stress confidence      ──→  The Fetch
Active energy ─────────────→  Load + Motion
Wrist temperature ─────────→  The Spots
SpO2 readings ─────────────→  SpO2 (flagged <95%)    ──→  The Spots
Resp. rate raw ────────────→  Resp. rate (7d trend)  ──→  The Spots
VO2 Max ───────────────────→  The Spots
```

---

## Pillar 1 — Recovery Score → Sleep Score (0–100)

**CRS weight:** 50% of CRS
**Architecture role:** Forms 35% of Form. Feeds Sleep (Tier 1 card) and Sleep Debt.

Measures what happened to your body during last night's sleep. High Recovery Score with low CASS is the most common "structurally fine sleep but still depleted" pattern — the system never conflates sleep quality with readiness.

### Sub-component weights

| Sub-component | Abbreviation | Weight |
|---|---|---|
| Sleep Stage Quality | SSQ | 50% |
| Respiratory Rate Score | RRS | 20% |
| SpO2 Score | SO2S | 20% |
| Wrist Temperature Score | WTS | 10% |

```
Recovery Score = (SSQ × 0.50) + (RRS × 0.20) + (SO2S × 0.20) + (WTS × 0.10)
```

---

### 1A — Sleep Stage Quality (SSQ)

**Data source:** Apple Watch HealthKit sleep stages — `AsleepCore`, `AsleepDeep`, `AsleepREM`, `Awake`, `InBed` (all in minutes)

**Step 1 — Total Sleep Time:**
```
TST = AsleepCore + AsleepDeep + AsleepREM
```

**Step 2 — Proportions:**
```
Deep% = AsleepDeep / TST × 100
REM%  = AsleepREM  / TST × 100
SE%   = TST / InBed × 100
```

**Step 3 — Score each proportion:**

**Deep Sleep Score** — research target: 13–23% of TST
```
If Deep% ≥ 13 and ≤ 23  →  score = 100
If Deep% < 13            →  score = (Deep% / 13) × 100
If Deep% > 23            →  score = 100  (excess not penalised)
```

**REM Score** — research target: 20–25% of TST
```
If REM% ≥ 20 and ≤ 25   →  score = 100
If REM% < 20             →  score = (REM% / 20) × 100
If REM% > 25             →  score = 100
```

**Sleep Efficiency Score** — research target: ≥ 85%
```
If SE% ≥ 85   →  score = 100
If SE% < 85   →  score = (SE% / 85) × 100
```

**Architecture addendum** — additional penalties applied on top of SSQ in the Sleep score:
- Deep sleep below 8% → −20 penalty on Sleep score
- REM below threshold → −8 penalty on Sleep score
- Bedtime drift > 60 min from personal usual → −10 on Sleep score
- Bedtime drift > 120 min → −20 on Sleep score
- Sleep Debt contribution → capped at −30 on Sleep score (14-day rolling, each hour under 7.5h adds to debt, repays at 0.5× rate)

**Step 4 — SSQ formula:**
```
SSQ = (Deep Sleep Score × 0.40) + (REM Score × 0.35) + (Sleep Efficiency Score × 0.25)
```

---

### 1B — Respiratory Rate Score (RRS)

**Data source:** Apple Watch — multiple RR readings per night. Use **median** (not mean) to protect against movement artifacts.

Research-validated normal range during sleep: 12–20 breaths/min. Cognitive recovery is impaired above 18 or below 12.

```
If Median_RR ≥ 12 and ≤ 18   →  RRS = 100
If Median_RR > 18             →  RRS = max(0, 100 − ((Median_RR − 18) × 10))
If Median_RR < 12             →  RRS = max(0, (Median_RR / 12) × 100)
```

> The ×10 penalty per breath above 18 means RR of 23 scores 50. RR of 23 during sleep signals significant physiological stress — the harsh penalty is appropriate. Flagged in product as an upward-trending 7-day signal, surfaced in The Spots.

---

### 1C — SpO2 Score (SO2S)

**Data source:** Apple Watch Series 6+ — SpO2 readings averaged across the night.

Research threshold: ≥ 95% is normal. Below 95% begins to impair cognitive restoration. Below 90% is clinically significant.

```
If Median_SpO2 ≥ 95              →  SO2S = 100
If Median_SpO2 ≥ 90 and < 95    →  SO2S = ((Median_SpO2 − 90) / 5) × 100
If Median_SpO2 < 90              →  SO2S = 0
```

> In the product: SpO2 is invisible on the console unless it drops below 95%. When it surfaces, it surfaces in The Spots. It does not interrupt the Form score display directly.

---

### 1D — Wrist Temperature Score (WTS)

**Data source:** Apple Watch Series 8+ — deviation from personal baseline in °C (not absolute temperature).

Normal range: ±0.5°C deviation. Persistent positive deviation (> +0.5°C) signals elevated allostatic load or early illness.

```
If deviation ≥ −0.5 and ≤ +0.5  →  WTS = 100
If deviation > +0.5              →  WTS = max(0, 100 − ((deviation − 0.5) × 100))
If deviation < −0.5              →  WTS = max(0, 100 − ((−0.5 − deviation) × 50))
```

> Downward deviation uses ×50 (not ×100) because cold deviation is less cognitively meaningful than elevated temperature. Feeds The Spots for pattern tracking.

---

### Sleep Debt (architecture addition to Pillar 1)

Not in the original CRS formula as a standalone sub-component, but modifies Sleep score in the architecture:

```
Sleep Debt = 14-day weighted rolling sum of (hours under 7.5h per night)
Repayment rate = 0.5× (slow recovery)
Maximum Sleep score penalty = −30 points
```

Direction of Sleep Debt trend matters as much as the absolute number.

---

### Pillar 1 Worked Example

Pilot, transatlantic flight, 6.5 hours sleep.

| Input | Value |
|---|---|
| InBed | 420 min |
| AsleepCore | 278 min |
| AsleepDeep | 52 min |
| AsleepREM | 68 min |
| Median Respiratory Rate | 16.2 breaths/min |
| Median SpO2 | 96.1% |
| Wrist Temp deviation | +0.8°C |

```
TST = 278 + 52 + 68 = 398 min
Deep% = 13.1%  → Deep Sleep Score = 100  (just above 13% threshold)
REM%  = 17.1%  → REM Score = (17.1/20) × 100 = 85.5
SE%   = 94.8%  → SE Score = 100

SSQ = (100 × 0.40) + (85.5 × 0.35) + (100 × 0.25) = 40 + 29.9 + 25 = 94.9
RRS = 100  (16.2 within 12–18)
SO2S = 100  (96.1 ≥ 95)
WTS = 100 − ((0.8 − 0.5) × 100) = 70

Recovery Score = (94.9 × 0.50) + (100 × 0.20) + (100 × 0.20) + (70 × 0.10)
              = 47.45 + 20 + 20 + 7 = 94.45
```

> Recovery Score of 94 for a jet-lagged pilot is correct and expected. The Recovery Score reflects sleep structure during the session — not accumulated state. The pilot's sleep was structurally efficient. What drags his Form down is CASS and ILAS, not sleep. This prevents the system from misattributing root cause.

---

## Pillar 2 — CASS → HRV score + Resting HR (0–100)

**CRS weight:** 35% of CRS
**Architecture role:** CASS feeds into Form via HRV score (25% of Form) and Resting HR (feeds Stress confidence). Never shown directly to user — surfaced through The Brief, The Fetch, and The Spots.

Measures the real-time state of the autonomic nervous system. The most diagnostically powerful pillar.

### Sub-component weights

| Sub-component | Abbreviation | Weight |
|---|---|---|
| Morning HRV Score | HRVS | 60% |
| Resting Heart Rate Trend Score | RHRTS | 25% |
| Walking Heart Rate Average Score | WHAS | 15% |

```
CASS = (HRVS × 0.60) + (RHRTS × 0.25) + (WHAS × 0.15)
```

---

### 2A — Morning HRV Score (HRVS)

**Data source:** Apple Watch — RMSSD via `HKHeartbeatSeriesQuery` (true IBI). Falls back to SDNN if IBI unavailable.

HRV is entirely individual. Population averages are meaningless here. Personal baseline normalisation is mandatory.

**Step 1 — Personal baseline (rolling 30-day):**
```
Personal_HRV_Baseline = rolling 30-day mean of morning SDNN/RMSSD readings
Personal_HRV_SD       = rolling 30-day standard deviation of those readings
```

**Step 2 — Today's Z-score:**
```
Z = (Today_HRV − Personal_HRV_Baseline) / Personal_HRV_SD
```

**Step 3 — Convert to 0–100:**
```
HRVS = min(100, max(0, 50 + (Z × 15)))
```

**Reference table:**

| Z-score | HRVS | Meaning |
|---|---|---|
| +3.3 | 100 | Ceiling |
| +2.0 | 80 | Well above your norm |
| +1.0 | 65 | Above your norm |
| 0.0 | 50 | Exactly your average |
| −1.0 | 35 | Below your norm |
| −2.0 | 20 | Well below your norm |
| −3.3 | 0 | Floor |

> ×15 per SD is calibrated so that 1 SD below baseline scores 35 (not 0) — proportionate to the research finding that 1 SD below is meaningfully concerning but not catastrophic.

**Architecture addendum:** HRV score in the product is time-of-day normalised across 6 blocks. Trend bonus applied if 7-day HRV is improving relative to 30-day baseline. Feeds Form (25%), Stress confidence, and The Fetch.

---

### 2B — Resting Heart Rate Trend Score (RHRTS)

**Data source:** Apple Watch — `RestingHeartRate`. Single-day readings are noisy; 7-day trend is the signal.

```
RHR_7day_avg = mean of last 7 days' RestingHeartRate readings
RHR_delta    = RHR_today − RHR_7day_avg

If RHR_delta ≤ 0   →  RHRTS = 100
If RHR_delta > 0   →  RHRTS = max(0, 100 − (RHR_delta × 10))
```

> Every bpm above 7-day average costs 10 points. +5 bpm (common after poor sleep or early illness) = 50. +10 bpm = 0. Feeds Stress confidence in the architecture.

---

### 2C — Walking Heart Rate Average Score (WHAS)

**Data source:** Apple Watch — `WalkingHeartRateAverage`.

Elevated walking HR relative to personal norm signals physical fatigue, cardiovascular strain, or autonomic dysregulation.

```
Walking_HR_Baseline = 30-day rolling mean of WalkingHeartRateAverage
Delta               = Today_WalkingHR − Walking_HR_Baseline

If Delta ≤ 0   →  WHAS = 100
If Delta > 0   →  WHAS = max(0, 100 − (Delta × 5))
```

> ×5 penalty (vs ×10 for RHR) because walking HR is noisier and more context-dependent.

---

### Stress Confidence (architecture layer on top of CASS)

Not in the CRS formula directly, but computed alongside CASS for intraday monitoring:

```
Stress confidence = (HRV drop × 0.35) + (HR elevation × 0.25) + (sustained duration × 0.20) + (sedentary state × 0.20)
```

- ≥ 0.60 sustained for 10+ minutes → fires **The Fetch** (max 3/day, 2-hour cooldown)
- ≥ 0.80 → HIGH alert
- Never shown as a raw number to users

---

### Pillar 2 Worked Example

Same pilot, morning after.

| Input | Value |
|---|---|
| Today's morning SDNN | 28 ms |
| Personal 30-day HRV mean | 42 ms |
| Personal 30-day HRV SD | 8 ms |
| Today's Resting HR | 62 bpm |
| 7-day RHR average | 54 bpm |
| Today's Walking HR | 89 bpm |
| 30-day Walking HR baseline | 82 bpm |

```
Z = (28 − 42) / 8 = −1.75
HRVS = 50 + (−1.75 × 15) = 23.75

RHR_delta = 62 − 54 = +8 bpm
RHRTS = 100 − (8 × 10) = 20

Delta = 89 − 82 = +7 bpm
WHAS = 100 − (7 × 5) = 65

CASS = (23.75 × 0.60) + (20 × 0.25) + (65 × 0.15)
     = 14.25 + 5 + 9.75 = 29
```

> CASS of 29 is a clear "do not operate without intervention" signal. Despite structurally efficient sleep (Recovery Score = 94), the autonomic system is significantly depleted. HRV suppressed nearly 2 SDs below personal norm. RHR elevated 8 bpm above 7-day average. The combination points to sympathetic activation — not just fatigue.

---

## Pillar 3 — ILAS → Load + Circadian score (0–100)

**CRS weight:** 15% of CRS
**Architecture role:** Splits into two product-facing components — **Load** (Tier 1, 0–21, TRIMP-based, updates in real time) and **Circadian score** (Tier 2, feeds Form at 25%). ILAS is the calculation engine unifying both.

Higher load = lower ILAS score. "Inverse" because accumulation works against readiness.

### Sub-component weights

| Sub-component | Abbreviation | Weight |
|---|---|---|
| Energy Expenditure Score | EES | 30% |
| Physical Effort Score | PES | 25% |
| Circadian Disruption Penalty | CDP | 30% |
| Daylight Adequacy Score | DAS | 15% |

```
ILAS = (EES × 0.30) + (PES × 0.25) + (CDP × 0.30) + (DAS × 0.15)
```

---

### 3A — Energy Expenditure Score (EES)

**Data source:** Apple Watch — `ActiveEnergyBurned` (kcal, intentional movement only — not total energy).

Uses a 48-hour window (not 24h) because energy debt accumulates across days.

```
Energy_48h       = sum of ActiveEnergyBurned over last 48 hours
Energy_baseline  = 30-day rolling daily average × 2  (normalised to 48h)
Load_ratio       = Energy_48h / Energy_baseline

If Load_ratio ≤ 1.0   →  EES = 100
If Load_ratio > 1.0   →  EES = max(0, 100 − ((Load_ratio − 1.0) × 100))
```

**Reference:**

| Load ratio | EES |
|---|---|
| ≤ 1.0 (at or under baseline) | 100 |
| 1.2 (20% above baseline) | 80 |
| 1.5 (50% above baseline) | 50 |
| 2.0 (double baseline) | 0 |

---

### 3B — Physical Effort Score (PES)

**Data source:** Apple Watch — `PhysicalEffort` (METs × body mass × time, in kcal/hr·kg). Uses 24-hour window.

```
MET_24h_avg  = mean of PhysicalEffort readings over last 24h
MET_baseline = 30-day rolling mean of daily average PhysicalEffort
MET_ratio    = MET_24h_avg / MET_baseline

If MET_ratio ≤ 1.0   →  PES = 100
If MET_ratio > 1.0   →  PES = max(0, 100 − ((MET_ratio − 1.0) × 80))
```

> ×80 slope (vs ×100 for EES) because PhysicalEffort readings are noisier.

**Architecture — Load (Tier 1, 0–21):** The product-facing Load metric is log-scaled from TRIMP (heart rate zone × time weighting). Updates in real time throughout the day. Resets at midnight. At 9.2 you have room. At 18+ you're overreaching. PES and EES are the deeper calculation inputs that feed this alongside TRIMP.

---

### 3C — Circadian Disruption Penalty (CDP)

**Data source:** Apple Watch timezone metadata attached to sleep records.

```
TZ_current  = timezone of most recent sleep session
TZ_previous = timezone of sleep session 48h prior
TZ_delta    = |TZ_current − TZ_previous| in hours

If TZ_delta = 0    →  CDP = 100
If TZ_delta > 0    →  CDP = max(0, 100 − (TZ_delta × 12))
```

**Calibration reference:**

| Timezone shift | CDP |
|---|---|
| 0 hours | 100 |
| 1 hour | 88 |
| 3 hours (cross-country US) | 64 |
| 5.5 hours (India → UK) | 34 |
| 8 hours (India → US East) | 4 |
| ≥ 9 hours | 0 |

> ×12 per hour calibrated against research: cognitive performance degrades approximately linearly with timezone shift up to ~8 hours.

**Architecture — Circadian score (Tier 2):** The product version adds wake-time consistency. Gap between actual wake time and chronotype-optimal wake time: ±30 min = 100, ±2 hr = 40. Bedtime consistency bonus from 14-day standard deviation. Forms 25% of Form. CDP is the calculation engine underneath this.

---

### 3D — Daylight Adequacy Score (DAS)

**Data source:** Apple Watch — `TimeInDaylight` (minutes per day) and `MaximumLightIntensity`.

Research: 30 minutes of outdoor light = minimum for circadian entrainment. 120 minutes = optimal.

```
If TimeInDaylight ≥ 120          →  DAS = 100
If TimeInDaylight ≥ 30 and < 120 →  DAS = ((TimeInDaylight − 30) / 90) × 100
If TimeInDaylight < 30           →  DAS = (TimeInDaylight / 30) × 50
```

> In the product, DAS does not have a direct display element. It surfaces through The Spots as an observation when daylight exposure is insufficient. DAS below a threshold generates a specific actionable Spot: *"Get 30 minutes of outdoor light in the next 2 hours."*

---

### Motion Score (architecture addition to Pillar 3)

The product adds Motion score as a dedicated Tier 2 component feeding Form (15% weight). It aggregates movement signals not fully captured by EES/PES:

```
Motion score components:
- Steps:         < 3,000 = 20  |  5,000 = 50  |  8,000 = 75  |  10,000+ = 90
- Exercise mins: 0 mins = −10 penalty  |  30+ mins = +10 bonus
- Stand hours:   < 6 hours = 0 contribution  |  8+ hours = +5 bonus
```

---

### Pillar 3 Worked Example

Same pilot, Mumbai (UTC+5:30) → London (UTC+1).

| Input | Value |
|---|---|
| ActiveEnergy last 48h | 1,840 kcal |
| 30-day daily avg ActiveEnergy | 780 kcal → 48h baseline = 1,560 kcal |
| MET 24h average | 2.8 kcal/hr·kg |
| 30-day MET baseline | 2.1 kcal/hr·kg |
| TZ_delta | 4.5 hours |
| TimeInDaylight | 22 min |

```
EES: Load_ratio = 1,840 / 1,560 = 1.18
     EES = 100 − ((1.18 − 1.0) × 100) = 82

PES: MET_ratio = 2.8 / 2.1 = 1.33
     PES = 100 − ((1.33 − 1.0) × 80) = 73.6

CDP: 4.5h shift → CDP = 100 − (4.5 × 12) = 46

DAS: 22 min < 30 → DAS = (22/30) × 50 = 36.7

ILAS = (82 × 0.30) + (73.6 × 0.25) + (46 × 0.30) + (36.7 × 0.15)
     = 24.6 + 18.4 + 13.8 + 5.5 = 62.3
```

---

## Final Form / CRS Computation

```
CRS = (Recovery Score × 0.50) + (CASS × 0.35) + (ILAS × 0.15)
```

**Full pilot example:**

| Pillar | Score | Weight | Contribution |
|---|---|---|---|
| Recovery Score (Sleep score) | 94.45 | 0.50 | 47.2 |
| CASS (autonomic) | 29.0 | 0.35 | 10.2 |
| ILAS (load/circadian) | 62.3 | 0.15 | 9.3 |
| **Form / CRS** | | | **66.7** |

**Interpretation:** CRS of 67 is accurate and telling. Sleep structure was efficient (Recovery = 94). The autonomic system is the bottleneck (CASS = 29 — suppressed HRV, elevated RHR). Circadian disruption and insufficient daylight are additional drags in ILAS. Recovery Score being high prevents a false panic. CASS being low drives the intervention: autonomic protocol, not a nap.

---

## Form Score — Architecture Composition

The product exposes Form as a 0–100 number built from four visible Tier 2 components:

| Component | Feeds from | Form weight |
|---|---|---|
| Sleep score | SSQ, RRS, SO2S, WTS, Sleep Debt, Bedtime drift | 35% |
| HRV score | RMSSD vs 7-day personal baseline, time-of-day normalised | 25% |
| Circadian score | Wake time vs chronotype, bedtime consistency, CDP | 25% |
| Motion score | Steps, exercise mins, stand hours, active energy | 15% |

**Form thresholds (user-facing):**
- 80+ → peak day
- 60–79 → normal range
- 50–59 → reduce demands
- Below 50 → protect energy, Waldo intervenes

---

## Score Drift Bias Detection

### Two Failure Modes

**Score Collapse** — one pillar below 30, dragging the entire CRS down even if others are healthy. Requires immediate intervention.

**Score Drag** — one or two pillars in the 30–60 range, slowly eroding CRS over days. No single morning looks alarming but the trend line is heading toward collapse. Requires scheduling and habit correction.

---

### Level 1 — Pillar Contribution Analysis

After CRS is computed each morning, the system substitutes each pillar with its neutral value (75) and measures the delta.

```
CRS_actual          = (RS × 0.50) + (CASS × 0.35) + (ILAS × 0.15)
CRS_if_RS_neutral   = (75 × 0.50) + (CASS × 0.35) + (ILAS × 0.15)
CRS_if_CASS_neutral = (RS × 0.50) + (75 × 0.35)   + (ILAS × 0.15)
CRS_if_ILAS_neutral = (RS × 0.50) + (CASS × 0.35)  + (75 × 0.15)

RS_drag   = CRS_if_RS_neutral   − CRS_actual
CASS_drag = CRS_if_CASS_neutral − CRS_actual
ILAS_drag = CRS_if_ILAS_neutral − CRS_actual
```

Positive drag = that pillar is suppressing CRS below neutral. Negative drag = that pillar is above neutral, helping.

**Pilot example:**

```
CRS_actual          = 66.7
CRS_if_RS_neutral   = (75 × 0.50) + (29 × 0.35) + (62.3 × 0.15) = 56.7
CRS_if_CASS_neutral = (94.45 × 0.50) + (75 × 0.35) + (62.3 × 0.15) = 82.5
CRS_if_ILAS_neutral = (94.45 × 0.50) + (29 × 0.35) + (75 × 0.15)   = 68.5
```

| Pillar | Drag | Role |
|---|---|---|
| RS | −10.0 | Helping (above neutral) |
| CASS | +15.8 | **Primary culprit** |
| ILAS | +1.8 | Minor drag |

Result: do not tell this pilot to improve his sleep. Tell him his autonomic system is the bottleneck.

---

### The Six Combination Patterns

| # | Low pillars | Healthy pillars | Interpretation | Intervention |
|---|---|---|---|---|
| 1 | RS | CASS + ILAS | Sleep failed — nervous system did not reset overnight | Sleep hygiene, nap protocol, flag sleep disorder if persistent |
| 2 | CASS | RS + ILAS | ANS depleted despite adequate sleep and manageable load — suggests emotional/cognitive stress or undetected sleep quality gap | Parasympathetic activation, breathing protocol, reduce cognitive demands for 4–6 hours |
| 3 | ILAS | RS + CASS | Load accumulated but recovery still holding — **early warning state** | Preventive: schedule load reduction before next high-demand period |
| 4 | RS + CASS | ILAS | Most common after illness onset or psychological stress — internal cause, load data shows nothing | Different agent tone: "something is affecting your baseline physiology that isn't captured in activity data" |
| 5 | RS + ILAS | CASS | **Most dangerous pattern** — CASS hasn't yet responded to accumulated damage. Body drawing on reserves. | Elevate alert: **pre-collapse warning** — "Your autonomic system appears intact but your sleep and load data suggest reserves that will not be there tomorrow" |
| 6 | CASS + ILAS | RS | Post-travel / post-high-stakes-day — recovery is working but not fast enough | Extend recovery window; use predictive function: "CRS will return to baseline by approximately [time]" |

---

### Level 2 — Sub-Component Drag Analysis

Once the primary dragging pillar is identified, the same neutral substitution cascades into that pillar's sub-components.

#### Inside CASS

```
CASS_if_HRV_neutral = (75 × 0.60)    + (RHRTS × 0.25) + (WHAS × 0.15)
CASS_if_RHR_neutral = (HRVS × 0.60)  + (75 × 0.25)    + (WHAS × 0.15)
CASS_if_WHA_neutral = (HRVS × 0.60)  + (RHRTS × 0.25) + (75 × 0.15)

HRV_drag = CASS_if_HRV_neutral − CASS_actual
RHR_drag = CASS_if_RHR_neutral − CASS_actual
WHA_drag = CASS_if_WHA_neutral − CASS_actual
```

**Pilot example (CASS = 29):**

```
CASS_if_HRV_neutral = (75 × 0.60) + (20 × 0.25) + (65 × 0.15)     = 59.75
CASS_if_RHR_neutral = (23.75 × 0.60) + (75 × 0.25) + (65 × 0.15)  = 42.75
CASS_if_WHA_neutral = (23.75 × 0.60) + (20 × 0.25) + (75 × 0.15)  = 30.5
```

| Sub-component | Drag | Role |
|---|---|---|
| HRV | +30.75 | **Dominant suppressor** |
| RHR | +13.75 | Significant |
| Walking HR | +1.5 | Negligible |

**Fingerprint interpretation:**
- HRV suppressed + RHR elevated → sympathetic activation → consistent with timezone shift + physical exertion
- HRV suppressed + RHR normal → parasympathetic withdrawal → points to emotional/cognitive stress origin

#### Inside ILAS

```
CDP_drag = ILAS_if_CDP_neutral − ILAS_actual
DAS_drag = ILAS_if_DAS_neutral − ILAS_actual
EES_drag = ILAS_if_EES_neutral − ILAS_actual
PES_drag = ILAS_if_PES_neutral − ILAS_actual
```

**Pilot example (ILAS = 62.3):**

```
ILAS_if_CDP_neutral = (82×0.30) + (73.6×0.25) + (75×0.30)   + (36.7×0.15) = 71.0
ILAS_if_DAS_neutral = (82×0.30) + (73.6×0.25) + (46×0.30)   + (75×0.15)   = 68.05
ILAS_if_EES_neutral = (75×0.30) + (73.6×0.25) + (46×0.30)   + (36.7×0.15) = 60.2
```

| Sub-component | Drag | Role |
|---|---|---|
| CDP | +8.7 | **Dominant — timezone shift** |
| DAS | +5.75 | Secondary — daylight deficit |
| EES | −2.1 | Slightly above neutral (helping) |

#### Inside Recovery Score

```
SSQ_drag  = RS_if_SSQ_neutral  − RS_actual
RRS_drag  = RS_if_RRS_neutral  − RS_actual
SO2S_drag = RS_if_SO2S_neutral − RS_actual
WTS_drag  = RS_if_WTS_neutral  − RS_actual
```

**Pilot example (RS = 94.45):**

```
RS_if_WTS_neutral = (94.9×0.50) + (100×0.20) + (100×0.20) + (75×0.10) = 94.95
WTS_drag = +0.5  ← negligible
```

All RS sub-components healthy. System correctly maintains diagnostic focus on CASS.

---

### The Full Causal Chain (pilot)

```
Form is 67
  → CASS is the primary drag (+15.8 points)
    → HRV is the dominant CASS suppressor (+30.75)
      → HRV suppressed to Z = −1.75 (28ms vs 42ms personal norm)
        → Caused by timezone shift (4.5h, CDP = 46)
          → Corroborated by daylight deficit (22 min, DAS = 36.7)
```

That is a sentence the agent can say to the user in full.

---

### The Agent Decision Tree — Every Morning

```
1.  Compute CRS_actual (Form score)

2.  Compute Pillar_drag for RS, CASS, ILAS

3.  Identify Primary_drag_pillar  (highest positive drag)
    Identify Secondary_drag_pillar (second highest, if > 5 points)

4.  For Primary_drag_pillar → compute Sub-component drag scores

5.  Identify Primary_drag_subcomponent

6.  Map (Primary_pillar, Primary_subcomponent) → Intervention_type

7.  Check for Pre-collapse pattern (Combination 5 — RS + ILAS low, CASS healthy)
    If detected → elevate alert regardless of CRS absolute value

8.  Generate agent message:
    ├─ Form score with directional context (vs yesterday, vs 7-day avg)
    ├─ Named causal chain: "Your Form is X. The primary drag is [pillar],
    │  specifically [subcomponent], which suggests [physiological interpretation]."
    ├─ Single prioritised intervention (not a list — one thing)
    └─ Estimated recovery window: "Based on your recovery trajectory,
       expect Form to return to your baseline of [Y] by approximately [time]"
```

> Recovery window is computed by fitting a linear regression to the last 7 days of the primary dragging sub-component and projecting forward.

---

## Complete Metric Reference Table

| Metric | Internal Name | Product Name | Type | Range | CRS Weight |
|---|---|---|---|---|---|
| Cognitive Readiness Score | CRS | **Form** | Tier 1 output | 0–100 | — |
| Physical load (TRIMP) | ILAS component | **Load** | Tier 1 output | 0–21 | 15% via ILAS |
| Sleep-based recovery | Recovery Score | **Sleep score** | Tier 2 | 0–100 | 50% of CRS |
| Sleep stage quality | SSQ | — | Sub-component | 0–100 | 25% of RS |
| Respiratory rate score | RRS | Resp. rate | Sub-component | 0–100 | 10% of RS |
| SpO2 score | SO2S | SpO2 | Sub-component | 0–100 | 10% of RS |
| Wrist temperature score | WTS | Wrist temp | Sub-component | 0–100 | 5% of RS |
| Sleep debt | — | Sleep Debt | Tier 2 modifier | penalty up to −30 | modifies Sleep score |
| Autonomic state | CASS | (internal) | Internal pillar | 0–100 | 35% of CRS |
| HRV score | HRVS | HRV score | Tier 2 | 0–100 | 21% of CRS |
| Resting HR trend | RHRTS | Resting HR | Tier 2 | 0–100 | 8.75% of CRS |
| Walking HR score | WHAS | — | Sub-component | 0–100 | 5.25% of CRS |
| Stress confidence | — | Stress confidence | Tier 2 | 0.0–1.0 | triggers Fetch |
| Load accumulation | ILAS | Load + Circadian | Tier 1 + Tier 2 | 0–100 / 0–21 | 15% of CRS |
| Energy expenditure | EES | Active energy | Sub-component | 0–100 | 4.5% of CRS |
| Physical effort | PES | Exercise / TRIMP | Sub-component | 0–100 | 3.75% of CRS |
| Circadian disruption | CDP | Circadian score | Tier 2 | 0–100 | 4.5% of CRS |
| Daylight adequacy | DAS | The Spots | Sub-component | 0–100 | 2.25% of CRS |
| Motion | Motion score | Motion score | Tier 2 | 0–100 | 15% of Form |
| Circadian alignment | Circadian score | Circadian score | Tier 2 | 0–100 | 25% of Form |

---

## Design Principle

Telling a user their Form is 67 without attribution is useless and potentially harmful. They will try to fix everything simultaneously — sleep more, exercise less, get more sun — which is noise.

Telling them their Form is 67 because their HRV is 1.75 standard deviations below their norm because they crossed 4.5 timezone hours without adequate light exposure on arrival — that is a diagnosis. And a diagnosis has a specific, targeted treatment.

**That specificity is the product.**