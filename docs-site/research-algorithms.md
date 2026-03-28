# Waldo — Research, Algorithms & Intelligence Roadmap

**Date:** March 18, 2026
**Audience:** Co-founders, technical advisors, research partners
**Context:** This is the third of three shareable documents. Read the [One-Pager](WALDO_ONEPAGER.md) first for the pitch, the [Master Reference](WALDO_MASTER_REFERENCE.md) for the full build spec, and this document for the science and intelligence layer underneath.

> Waldo's moat is not the app — it's the algorithms, the personalization loop, and the data they generate. This document covers what's proven, what's assumed, what's unvalidated, and what comes next.

---

## Table of Contents

1. [The Core Algorithm: Cognitive Readiness Score (CRS)](#1-the-core-algorithm-cognitive-readiness-score)
2. [Stress Detection: Weighted Confidence Scoring](#2-stress-detection-weighted-confidence-scoring)
3. [HRV: The Science, The Limits, The Reality](#3-hrv-the-science-the-limits-the-reality)
4. [What's Proven vs What's Assumed](#4-whats-proven-vs-whats-assumed)
5. [Public Datasets for Validation](#5-public-datasets-for-validation)
6. [Device Accuracy: What We Can Actually Trust](#6-device-accuracy-what-we-can-actually-trust)
7. [The Personalization Engine](#7-the-personalization-engine)
8. [AI Agent Intelligence: How Claude Reasons About Health](#8-ai-agent-intelligence-how-claude-reasons-about-health)
9. [What We're NOT Building (And Why)](#9-what-were-not-building-and-why)
10. [Research Roadmap: MVP → Phase 4](#10-research-roadmap-mvp--phase-4)
11. [Open Questions for Co-Founders](#11-open-questions-for-co-founders)

---

## 1. The Core Algorithm: Cognitive Readiness Score

### What It Is

A 0-100 composite score predicting how prepared a person is to handle cognitive demands RIGHT NOW. Updated every 15 minutes from wearable data. Computed on-phone (not server) for offline access, privacy, and instant display.

### CRS vs Commercial Scores: Transparency as Differentiator

A 2025 peer-reviewed paper in *Translational Exercise Biomedicine* (Altini, Dougherty et al.) systematically evaluated 14 composite health scores from 10 wearable manufacturers (Oura Readiness, WHOOP Recovery, Garmin Body Battery, Fitbit Daily Readiness, etc.). Key findings:

- **No manufacturer discloses how scores are calculated**
- **No composite scores have been validated against clinical outcomes in peer-reviewed literature**
- Most common inputs: HRV (86%), resting HR (79%), physical activity (71%), sleep duration (71%)
- The scores "lack transparency, validation across populations, and standardized methods"

**CRS is the first open composite readiness score.** Unlike every competitor, we publish the formula, the weights, the scientific basis for each component, and an honest assessment of what's validated vs assumed. This is a genuine competitive advantage — especially for the quantified-self early adopter ICP who distrusts black boxes.

### Scientific Lineage: SAFTE-FAST

CRS is a consumer adaptation of **SAFTE-FAST** (Sleep, Activity, Fatigue, Task Effectiveness) — the U.S. Army's biomathematical model for predicting cognitive performance, developed at Walter Reed Army Institute of Research. SAFTE-FAST has been validated by the FAA and is used in military and aviation fatigue risk management. It uses a three-process model: circadian function, homeostatic sleep reservoir, and sleep inertia.

CRS extends SAFTE-FAST's validated sleep + circadian foundation with real-time HRV and activity signals from consumer wearables. This gives CRS stronger academic parentage than any consumer wearable score currently on the market.

### The Formula

```
CRS = (Sleep * 0.35) + (HRV * 0.25) + (Circadian * 0.25) + (Activity * 0.15)
```

### Why These Weights

| Component | Weight | Scientific Basis |
|-----------|--------|-----------------|
| **Sleep** | 35% | Strongest predictor of next-day cognitive performance (military SAFTE-FAST model). Universal across all wearables. Most reliable signal. |
| **HRV** | 25% | Best real-time autonomic nervous system indicator. Daytime wrist HRV is noisy — 25% reflects that uncertainty. |
| **Circadian** | 25% | Borbely two-process model: 25%+ of performance variance comes from time-of-day alignment with personal chronotype. |
| **Activity** | 15% | Moderate effect. Sweet spot matters (too sedentary = bad, overtraining = bad) but effect size is smaller than sleep/HRV/circadian. |

### Score Zones

| Range | Zone | Color | Meaning |
|-------|------|-------|---------|
| 80-100 | Peak | Teal | Optimal cognitive state — schedule deep work, important decisions |
| 50-79 | Moderate | Amber | Functional but suboptimal — routine tasks OK, avoid high-stakes decisions if possible |
| 0-49 | Low | Coral | Impaired — recovery needed, agent should intervene |

### Component Scoring (0-100 each)

**Sleep Score (35%):**
- Duration: target 7-9 hours. <6h penalizes heavily (-15/hour deficit). >9.5h slight penalty.
- Sleep stages: deep sleep <13% = -10, <8% = -20. REM <20% = -8.
- Efficiency: <85% = penalty proportional to gap
- Bedtime consistency: >60min deviation = -10, >120min = -20
- Cumulative sleep debt: rolling 7-day deficit, -5 points per hour (max -30)

**HRV Score (25%):**
- Deviation from TIME-OF-DAY-ADJUSTED 7-day baseline (most important correction — prevents afternoon false alarms)
- Trend: 7-day baseline vs 30-day baseline (improving or declining)
- Age-adjusted absolute floor (younger people naturally have higher HRV)
- Returns neutral (50) when no HRV data available

**Circadian Score (25%):**
- Chronotype-aware peak windows (estimated from 14-day midpoint of sleep)
- Hours since wake (crashes after 14-16h awake)
- Three chronotypes: early (peak ~10am), normal (peak ~11:30am), late (peak ~1pm)

**Activity Score (15%):**
- Steps: 6K+ good, 10K+ bonus, <2K penalty
- Sedentary time: >8h = penalty, >10h = double penalty
- Recent movement: <100 steps in 2h = -10
- Exercise: 20-60 min = bonus, >60 min = slight penalty (overtraining signal)

### Handling Missing Data

When components are unavailable (user didn't wear watch to bed, no HRV from device):
- If fewer than 3 components have real data → return "insufficient data" state (CRS = -1)
- If 3+ components available → redistribute weights proportionally among available signals
- UI shows "insufficient data" state instead of a misleading number

### What Production Systems Teach Us

| System | Key Lesson for Waldo |
|--------|----------------------|
| Garmin Body Battery | Consider "battery" trajectory view alongside CRS snapshot |
| WHOOP Recovery | 30-day baselines more stable than 7-day. Falls back to sleep-only when HRV unavailable |
| Oura Readiness | Component breakdown with color coding = trust |
| Samsung Stress | On-demand only, NOT continuous passive. Even Samsung doesn't trust passive daytime HRV |

**Implication:** Be conservative. Morning CRS (from overnight data) is most reliable. Daytime CRS is supplementary and should carry a confidence indicator.

---

## 2. Stress Detection: Weighted Confidence Scoring

### The Algorithm

```
Stress Confidence = weighted sum of:
  - HRV drop from baseline (35%)
  - HR elevation above normal (25%)
  - Duration of sustained change (20%)
  - Activity context — inverted (20%)
```

A confidence score of 0.0 to 1.0. NOT a binary "stressed/not-stressed."

### Why Weighted Confidence (Not Binary Gates)

The original design used binary AND gates: "IF HRV dropped >20% AND HR elevated >15% AND sustained >10 min THEN stress." This fails entirely when any single signal is missing (which is common — not all watches report HRV continuously).

Weighted confidence:
- Works with partial signals (HR-only watches still get stress detection, just lower confidence)
- Produces nuanced severity (0.62 vs 0.88 matters for intervention choice)
- Is fully explainable ("Your stress confidence was 0.72: HRV dropped 25%, HR up 18%, sustained 12 min")

### Thresholds and Actions

| Confidence | Action | Model (Phase 2) |
|-----------|--------|----------------|
| >= 0.80 | **HIGH** alert — immediate, detailed intervention | Opus |
| >= 0.60 | **MODERATE** alert — gentle check-in | Sonnet |
| 0.40-0.59 | **LOG** — track but don't alert | None |
| < 0.40 | **IGNORE** | None |

### 8-Point False Positive Reduction Strategy

This is where Waldo lives or dies. False positives destroy trust faster than missed alerts.

1. **Personal baselines, not population norms** — your "normal" HRV is the reference, not an age table
2. **Time-of-day normalization** — HRV naturally dips in the afternoon. Without adjustment, 3pm looks like stress every day. 6 time blocks with ratios (afternoon = 0.85x baseline). **The single most impactful correction.**
3. **Weighted confidence** — handles missing signals gracefully
4. **Activity exclusion** — if steps are high or exercise detected, suppress stress detection (exercise looks like stress to HRV)
5. **Temporal persistence** — must be sustained 10+ minutes. A 2-minute spike is noise, not stress.
6. **2-hour cooldown** — max 3 alerts per day. Conservative > annoying.
7. **User feedback loop** — every alert has [Helpful] / [Not helpful] / [Too frequent] buttons. Feedback tunes thresholds over time.
8. **Rules-based pre-filter** — if CRS > 60 AND confidence < 0.3, don't even call the AI. Saves 60-80% of API costs.

### First 7 Days: No Stress Alerts

During the baseline learning period, stress detection is disabled. No proactive stress alerts. Only morning briefs (which use overnight data, inherently more reliable). Daily learning messages keep users engaged: "Day 3: Your resting HR is 62 BPM, lower than average. That's good."

---

## 3. HRV: The Science, The Limits, The Reality

### What HRV Actually Measures

Heart Rate Variability (HRV) is the variation in time between consecutive heartbeats. Higher HRV generally indicates better autonomic regulation (parasympathetic dominance = "rest and digest"). Lower HRV correlates with stress, fatigue, illness.

We use **RMSSD** (Root Mean Square of Successive Differences) — the gold standard for short-term HRV measurement:

```
RMSSD = sqrt( sum( (IBI[i] - IBI[i-1])^2 ) / (n-1) )
```

### What HRV Is NOT

**HRV is not a stress meter.** Many things affect it beyond psychological stress:
- Caffeine, alcohol, medication
- Dehydration
- Posture changes
- Ambient temperature
- Menstrual cycle (lower in luteal phase)
- Illness / inflammation
- Overtraining

This is why we use multi-signal weighted confidence, not HRV alone.

### Why RMSSD and Nothing Else

| Metric | Waldo Verdict |
|--------|----------------|
| **RMSSD** | PRIMARY — 2-min windows, responsive to acute changes |
| lnRMSSD | Use internally for statistics (log-normalizes skewed distribution) |
| SDNN | Skip — needs 5+ min windows, mixes sympathetic + parasympathetic |
| pNN50 | Skip — r > 0.95 correlation with RMSSD, adds zero information |
| LF/HF ratio | **NEVER USE** — scientifically debunked (Billman 2013). Not a valid measure of sympathovagal balance. |
| Frequency-domain metrics | Skip for MVP, revisit if raw IBI from Samsung/Garmin enables it |

### The Artifact Rejection Pipeline

Raw IBI (Inter-Beat Interval) data from wrist PPG sensors is noisy. Our pipeline:

1. **Filter impossible values** — reject anything outside 300-2000ms (physiological range)
2. **Adaptive local median filter** (5-point window) — **interpolate** artifacts, don't delete them (deletion biases RMSSD downward — March 7 correction)
3. **Quality gate** — if >20% of values are artifacts, discard the entire window
4. **Minimum sample size** — require 30+ valid IBIs per window (80% threshold)
5. **Compute RMSSD** from cleaned signal

### Baseline Computation

```
7-day baseline: exponential moving average (alpha = 0.3)
  → more weight on recent days, smooths daily variation

30-day baseline: simple moving average
  → stable reference for trend detection

Time-of-day ratios (after 7 days):
  00:00-04:00 = 1.30 (deep sleep, highest)
  04:00-08:00 = 1.10 (waking)
  08:00-12:00 = 1.00 (morning reference)
  12:00-16:00 = 0.85 (afternoon dip)
  16:00-20:00 = 0.90 (evening)
  20:00-24:00 = 1.05 (pre-sleep)
```

### Cold Start

First night of sleep HRV becomes the immediate personal baseline. One night of real data is infinitely better than any population norm. Confidence intervals are wide (displayed as "72 +/- 8") and narrow as more nights accumulate.

---

## 4. What's Proven vs What's Assumed

| Claim | Status | Evidence | Risk if Wrong |
|-------|--------|---------|--------------|
| HRV drops under acute psychological stress | **PROVEN** | WESAD (93% binary accuracy with chest ECG), meta-analyses (Castaldo 2015, Kim 2018) | Low — this is established science |
| HRV from wrist PPG correlates with ECG-derived HRV | **PROVEN** | Oura MAPE 5.96%, Samsung ~8-12% (multiple studies) | Low — but accuracy varies by device |
| Sleep quality predicts next-day cognitive performance | **PROVEN** | Military SAFTE-FAST model, dozens of sleep deprivation studies | Low — strongest signal in CRS |
| Circadian rhythm affects cognitive performance | **PROVEN** | Borbely two-process model, shift work studies | Low |
| Multi-signal CRS (sleep+HRV+circadian+activity) > single signal | **ASSUMED** | Google's PHIA (84% on health reasoning), logical extension of above | Medium — needs validation with real user data |
| CRS zone thresholds (80/50) are meaningful | **ASSUMED** | No evidence. Arbitrary starting points. | High — must calibrate during self-test |
| Our specific weights (35/25/25/15) are optimal | **ASSUMED** | Informed by literature but not empirically tested | Medium — adaptive weights in Phase 3 |
| Proactive interventions improve outcomes | **ASSUMED** | No RCT evidence for mobile stress interventions via messaging | Medium — this is the product hypothesis |
| Personal baselines stabilize in 7 days | **PARTIALLY PROVEN** | TILES-2018 suggests 5-7 days for Fitbit | Medium — depends on data frequency |
| Time-of-day HRV normalization reduces false positives | **ASSUMED** | Physiologically sound, but not empirically tested in our system | Medium — validate in Phase G |
| Rules-based pre-filter saves 60-80% of AI calls | **ASSUMED** | No data. Depends on user stress distribution. | High if wrong — doubles AI cost |
| User feedback loop improves CRS accuracy over time | **ASSUMED** | Standard ML assumption. No evidence specific to CRS. | Medium — core of the moat thesis |

### The Honest Bottom Line

The individual signals (HRV, sleep, circadian, activity) affecting cognitive performance are well-established in literature. **What's unproven is our specific combination of them into a single score (CRS), the thresholds we chose, and whether proactive mobile interventions based on this score actually help people.** This is the product hypothesis we're testing.

---

## 5. Public Datasets for Validation

### Tier 1: Start Here (direct CRS + stress validation)

| Dataset | What It Is | Subjects | Why It Matters | Access |
|---------|-----------|----------|---------------|--------|
| **WESAD** | Lab stress detection (Trier Social Stress Test) | 15 | Gold standard: 93% binary stress accuracy from chest ECG. Validate our HRV stress signals. | [Kaggle](https://kaggle.com/datasets/orvile/wesad-wearable-stress-affect-detection-dataset) (CC BY 4.0) |
| **SWELL-KW** | Knowledge workers under time pressure + interruption | 25 | **Most directly relevant.** Our exact target user under our exact stress conditions. Pre-computed 5-min HRV indices. | [Kaggle](https://kaggle.com/datasets/qiriro/swell-heart-rate-variability-hrv) |
| **HRV + Cognitive Load** | d2 Attention Test + Switcher Test with HRV | 30 | Directly validates RMSSD → cognitive load correlation (the HRV → CRS link). NASA-TLX as ground truth. | [Kaggle](https://kaggle.com/datasets/audityasutarto/heart-rate-variability-and-cognitive-mental-load) |

### Tier 2: Deeper Validation (longitudinal, sleep, real wearables)

| Dataset | What It Is | Subjects | Why It Matters | Access |
|---------|-----------|----------|---------------|--------|
| **TILES-2018** | 10-week hospital worker study (Fitbit + surveys) | 212 | Validates time-of-day HRV patterns, baseline stabilization window, sleep → next-day performance. Real wearable data in real workplace. | [tiles-data.isi.edu](https://tiles-data.isi.edu) (DUA required) |
| **Wearanize+** | One-night PSG + Empatica E4 wristband | 130 | Validates wrist PPG sleep staging accuracy vs gold standard. Tells us how much to trust wearable sleep data. | [Radboud Repository](https://pmc.ncbi.nlm.nih.gov/articles/PMC12888818/) (CC BY 4.0) |
| **Sleep Deprivation + Cognition** | Sleep → cognitive performance effects | Multiple | Validates sleep component weight (35%) and penalty slopes in sleep score. | [Kaggle](https://kaggle.com/datasets/sacramentotechnology/sleep-deprivation-and-cognitive-performance) |
| **Wearable Stress + Exercise** | Stroop Test + cycling with HRV | 36 | Validates activity exclusion logic (exercise looks like stress to HRV). Calibrates our step counter gating. | [PhysioNet](https://physionet.org/content/wearable-device-dataset/1.0.1/) |

### Tier 3: Algorithm Testing + Edge Cases

| Dataset | What It Is | Use |
|---------|-----------|-----|
| **PMData** (Garmin, 16 users, 5 months) | Long-term Garmin lifelogging | Baseline drift over months, activity patterns |
| **Smartwatch 40K** (synthetic, 40K rows) | Synthetic but realistic smartwatch data | Pipeline testing, dashboard prototyping. **Not for validation.** |
| **PhysioNet RR databases** (54+ subjects) | Gold-standard ECG-derived RR intervals | Algorithm unit testing — verify RMSSD matches published values |

### Validation Plan

| Phase | What to Validate | Dataset | Success Criteria |
|-------|-----------------|---------|-----------------|
| **Pre-MVP** | RMSSD computation matches published values | PhysioNet RR | Error < 1ms vs reference |
| **Pre-MVP** | HRV drops detectably under stress | WESAD wrist BVP | RMSSD drops >= 15% under TSST |
| **Pre-MVP** | Sleep predicts cognitive performance | Sleep Deprivation dataset | r > 0.5 correlation |
| **During build** | Knowledge worker HRV under time pressure | SWELL-KW | RMSSD decreases under pressure |
| **During build** | Time-of-day normalization factors are real | TILES-2018 | Afternoon dip confirmed in real data |
| **During build** | Multi-signal > single signal | WESAD + SWELL | Weighted model outperforms univariate |
| **Post-MVP** | CRS zones map to real cognitive performance | Own user data + PVT test | Zone accuracy > 70% |

**Time to run Tier 1 validation:** 1-2 weekends. Python notebooks. No ML training needed — pure statistics.

---

## 6. Device Accuracy & Data Access: What We Can Actually Trust

### HealthKit (Apple Watch) — Data Access Deep Dive (March 2026 research)

Apple Watch via HealthKit provides the richest data available to any third-party health app (~120 data types vs Health Connect's ~49):

| Data Type | HealthKit API | Notes |
|-----------|--------------|-------|
| **Beat-to-beat IBI** | `HKHeartbeatSeriesQuery` | Individual beat timestamps as `timeSinceSeriesStart`. Derive IBI by subtracting consecutive timestamps. `precededByGap` flag indicates sensor contact loss. Compute true RMSSD yourself. iOS 13+. |
| **Pre-computed HRV** | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | SDNN only (not RMSSD). Use as fallback if beat-to-beat data unavailable. |
| **Heart Rate** | `HKQuantityTypeIdentifierHeartRate` | Samples every few seconds during workouts, less frequently at rest. |
| **Resting HR** | `HKQuantityTypeIdentifierRestingHeartRate` | Daily computed value. |
| **Sleep Stages** | `HKCategoryTypeIdentifierSleepAnalysis` | `.asleepREM`, `.asleepCore` (light), `.asleepDeep`, `.awake`, `.inBed`. Minute-level transitions. watchOS 9+. |
| **SpO2** | `HKQuantityTypeIdentifierOxygenSaturation` | All readings — daytime, overnight, workout. |
| **Respiratory Rate** | `HKQuantityTypeIdentifierRespiratoryRate` | During sleep only. |
| **ECG Voltage** | `HKElectrocardiogramQuery` | Raw voltage at 512 Hz, ~30 seconds, single-lead (Lead I). Third-party can read but not initiate recordings. |
| **Wrist Temperature** | Available | Sleep only, relative deviation from baseline. Series 8+. |
| **Steps** | `HKQuantityTypeIdentifierStepCount` | Full access. |
| **Background Delivery** | `HKObserverQuery` + `enableBackgroundDelivery` | `.immediate`, `.hourly`, `.daily`. No WorkManager, no OEM battery fights. |

**What HealthKit does NOT expose:** Raw PPG waveform (requires SensorKit + IRB approval), raw accelerometer (use CoreMotion instead), real-time continuous streaming (read stored data only).

**CRS quality by device:** Apple Watch with `HKHeartbeatSeriesQuery` gives you TRUE RMSSD from beat-to-beat data — this is equivalent to research-grade HRV, not a consumer approximation. This makes Apple Watch users the gold standard for CRS validation.

### Nocturnal HRV Accuracy (vs ECG gold standard)

| Device | MAPE | What It Means | HRV via API? |
|--------|------|--------------|--------------|
| Oura Gen 4 | 5.96% | Best available. Trust fully. | Yes (Oura API, Phase 3) |
| Apple Watch | ~6-8% (estimated from beat-to-beat IBI) | Excellent. Best data access via HealthKit. | **YES — MVP** (beat-to-beat IBI + SDNN) |
| WHOOP | 8.17% | Good. Mainly sleep-time. | Yes (WHOOP API, Phase 3) |
| Garmin | 10.52% | Good for daily baseline. | Partial (Health Connect) |
| Samsung Galaxy Watch | ~8-12% (estimated) | Good sensor, but HRV NOT written to Health Connect. | **NO via HC.** Samsung SDK post-MVP. |
| Pixel Watch | ~8-10% (estimated) | Good. | **YES — MVP** (RMSSD via Health Connect) |
| Budget devices (Noise, boAt) | Unknown, likely >15% | Low trust. HR-only stress detection. | HR only |

### Sleep Staging Accuracy (vs PSG gold standard)

| Device | Cohen's kappa | Deep Sleep | REM | Verdict |
|--------|--------------|------------|-----|---------|
| Apple Watch 8 | 0.53 (moderate) | 50.7% | 68.6% | Best overall staging |
| Fitbit Sense | 0.42 (moderate) | 48.3% | 55.5% | Decent |
| WHOOP 4.0 | 0.37 (fair) | 69.6% | 62.0% | Best deep sleep detection |
| Garmin | 0.21 (poor) | Poor | 28.7% | **Nearly unreliable for staging** |

### Implications for CRS

1. **Device-tagged confidence:** Samsung/Oura/Apple get full sleep weight. Garmin sleep stages get 50-60% weight. Budget devices get 40% weight (duration only, no staging).
2. **HRV measurement error:** Wrist HRV has ~8-12% error baked in. Never treat it as ground truth. This is why we use baselines (relative change) not absolute values.
3. **Oura users get the best CRS.** Garmin users get a degraded but functional CRS. Budget device users get a basic CRS (sleep duration + HR + activity, no HRV or staging).

---

## 7. The Personalization Engine

### How Waldo Gets Smarter Over Time

```
Week 1:  Population defaults → functional CRS (rough but useful)
Week 2:  Personal baselines stabilize → CRS becomes personal
Week 4:  Feedback loop active (10+ responses) → thresholds start adapting
Month 2: Patterns discovered → "Your HRV drops on meeting-heavy days"
Month 3: Adaptive weights possible → your sleep might matter 40%, not 35%
Month 6: Deep correlations → agent knows your stress triggers, recovery aids
```

### Three Personalization Mechanisms

**1. Baseline Personalization (automatic, no user input)**
- 7-day exponential moving average for HRV
- 30-day simple moving average for long-term trends
- Time-of-day ratios computed from your actual data after 7 days
- Chronotype estimated from your sleep midpoint over 14 days

**2. Feedback-Driven Threshold Adjustment (requires user responses)**
- Every proactive alert has feedback buttons
- After 10+ feedback events: slowly adjust stress confidence thresholds
- Change rate: 0.02 per feedback (slow, stable — prevents oscillation)
- Floor: no component below 0.10 weight. Ceiling: no component above 0.50.
- User can reset to defaults at any time

**3. Agent Memory (learns through conversation)**
- Agent stores patterns in `core_memory` (structured JSONB)
- "Record first, answer second" — when user shares health info ("started magnesium"), agent saves it BEFORE responding
- Patterns accumulate: preferred interventions, stress triggers, recovery aids, medication timing
- Weekly compaction: older conversations summarized, key facts promoted to core memory

### The Data Moat

Every thumbs-up/down on a CRS prediction is **labeled training data** that no competitor has:
- CRS + component scores + biometric snapshot + user feedback
- Over time: the largest dataset of subjective cognitive performance correlated with wearable biometrics
- This enables population models (Phase 3-4) and eventually federated learning

---

## 8. AI Agent Intelligence: How Claude Reasons About Health

### Not a Custom ML Model — An LLM With Health Context

Waldo does NOT train a custom model for MVP. It uses **Claude Haiku with carefully engineered context** (soul files + tiered health data + conversation memory). The intelligence comes from:

1. **Context assembly** — the right health data in the right format at the right time
2. **Mode-specific personality** — different soul files for stress alerts vs morning briefs vs conversation
3. **Tool access** — the agent can query health data, read/write memory, send messages
4. **Tiered data loading** — L0 (60 tokens, always), L1 (400 tokens, default), L2 (full history, on-demand)

### Why LLM Reasoning, Not ML Classification

Google's PHIA (Personal Health Information Agent) achieves 84% accuracy on health reasoning benchmarks — not by reading one number, but by **reasoning across multiple signals with contextual awareness.** This is exactly what Waldo does:

- ML classifier: "HRV = 28ms → stress probability 0.73"
- LLM reasoning: "HRV dropped 25% from your personal baseline at 2:30pm. You've been in back-to-back meetings since noon. You slept 5.2 hours last night. Your CRS is 42. This looks like accumulated cognitive fatigue, not acute stress. I'd suggest a 15-minute walk before your 3pm call, which is your most important meeting today."

The LLM connects dots that a classifier can't.

### When Custom Models Enter (Phase 3-4)

| Phase | Model | What It Does |
|-------|-------|-------------|
| MVP | Claude Haiku (prompt engineering) | Reasoning over health data via tool_use |
| Phase 2 | Claude Haiku + Sonnet + Opus (routing) | Model selection by task complexity |
| Phase 3 | Adaptive CRS weights (simple regression) | Per-user weight optimization from feedback |
| Phase 3 | Predictive cognitive model (time-series) | Next-day CRS prediction from patterns |
| Phase 4 | Population model (federated learning) | Cross-user patterns for better cold-start |
| Phase 4 | Predictive illness detection | Early warning from multi-day HRV/HR trends |

---

## 9. What We're NOT Building (And Why)

| Approach | Why Not |
|----------|---------|
| Custom ML model for MVP | Claude with good context engineering beats a custom model trained on no data. We have zero training data at launch. |
| Frequency-domain HRV analysis | Requires 5+ min stationary windows. Not practical for real-time wrist PPG. |
| LF/HF ratio for anything | Scientifically debunked as a measure of sympathovagal balance (Billman 2013). |
| EDA (electrodermal activity) for stress | Only Samsung Galaxy Watch 8+ has EDA. Not universal. Phase 3 if we add Samsung Sensor SDK. |
| Blood glucose / CGM integration | Interesting for cognitive performance, but Dexcom/Libre APIs are limited. Phase 3-4. |
| Voice biomarkers for stress | Requires microphone access, privacy concerns, low accuracy on consumer devices. Phase 4+. |
| Medical diagnosis of any kind | We are NOT a medical device. Clear disclaimers. Always suggest consulting a doctor. |

---

## 10. Research Roadmap: MVP → Phase 4

### MVP: Deterministic Algorithms + LLM Reasoning

- CRS computed on-phone (TypeScript, deterministic formula)
- Stress confidence computed on-phone (weighted scoring, deterministic)
- Claude Haiku reasons over health context (prompt engineering, no training)
- Feedback collected (thumbs up/down on every proactive alert)
- **No ML training. No custom models. Pure algorithms + LLM.**

### Phase 2: Personalization + Validation

- Feedback-driven threshold adjustment (simple, slow-moving parameter updates)
- Time-of-day ratios computed from personal data (statistical, not ML)
- Validate CRS against WESAD/SWELL-KW/TILES datasets (Python notebooks)
- Multi-model routing (severity → Haiku/Sonnet/Opus)
- **Workspace connector intelligence** — calendar/email/Slack context combined with biology for smarter interventions

### Phase 3: Predictive Intelligence

- **Adaptive CRS weights** per user (simple regression on 15+ feedback events)
- **Next-day CRS prediction** (time-series model trained on personal data — ARIMA or lightweight neural net)
- **Pattern discovery engine** — entity extraction from conversations + health data → knowledge graph
- **Device-specific confidence weighting** — Oura gets 100% weight, Garmin gets 60%, budget gets 40%
- Academic validation study (optional, post-traction)

### Phase 4: Population Intelligence + Advanced Models

- **Federated learning** — train population model across 1000+ users without sharing raw data
- **Better cold-start** — new users get personalized baselines from population model in hours, not days
- **Predictive illness detection** — multi-day HRV + HR trends flagging "you might be getting sick" 1-3 days early
- **Multi-agent specialists** — sleep agent + stress agent + activity agent coordinated by orchestrator
- **Health MCP Server** — open-source protocol for other AI agents to query your cognitive readiness

---

## 11. Open Questions for Co-Founders

These are the decisions and research directions that need co-founder input:

### Algorithm Questions
1. **Should morning CRS be the "official" score?** Overnight data is most reliable. Daytime CRS is noisier. Do we show both (morning CRS + live CRS with confidence indicator) or just one number?

2. **How aggressive should stress alerts be?** Conservative (miss some real stress, build trust) vs aggressive (catch more stress, risk false positives). Current setting: conservative (confidence >= 0.60, 2h cooldown).

3. **Should we weight CRS by device quality?** Oura users would get a "better" CRS than Garmin users. Is this confusing or honest?

### Product Questions
4. **When do we introduce workspace connectors?** Phase 2 adds calendar/email/Slack. These transform Waldo from "health alert bot" to "cognitive performance optimizer." Should this be the real MVP?

5. **Menstrual cycle awareness** — HRV varies significantly across the cycle (lower in luteal phase). Should we offer cycle-aware baselines for users who opt in? This prevents systematic false stress alerts for half the population.

6. ~~**Caffeine/medication self-report**~~ **RESOLVED: MVP.** "I had coffee" Telegram inline button suppresses stress alerts for 45 min. "I drank last night" adjusts morning CRS interpretation. Low effort, high personalization signal. Added to MVP scope (March 20, 2026).

### Research Questions
7. **Do we run the dataset validation before or during MVP build?** It's 1-2 weekends of Python notebooks. Running it first de-risks the algorithm. Running it in parallel saves time.

8. **Should we pursue the IIT Ropar study?** It costs Rs 12-15L and takes 6 months. The paper would be powerful for credibility and fundraising. But it's not on the critical path. When (if ever)?

9. ~~**Open-source the CRS algorithm?**~~ **RESOLVED: YES, after Phase G.** Open-source the validated CRS v1.0 (not the raw v0.1 — wait until tuned on real data). The algorithm isn't the moat — personalization data is. Open-sourcing builds credibility, attracts contributors, creates content for dev community marketing, and gives academic citations if researchers use it. Competitive risk is minimal because implementing the full system (data pipeline + agent + messaging + personalization) is 100x more work than the CRS formula. Decision date: March 20, 2026.

### Business Questions
10. **Is Waldo a product or a platform?** Product = end-user app with subscription. Platform = the "body API" that other agents (Lindy, OpenClaw) query via MCP/A2A. Both? Which first?

---

## Key References

- Task Force of ESC/NASPE (1996): HRV measurement standards
- Billman (2013): LF/HF ratio debunking
- Shaffer & Ginsberg (2017): HRV overview for practitioners
- Kim et al. (2018): HRV-stress meta-analysis
- Castaldo et al. (2015): Acute mental stress and short-term HRV
- **SAFTE-FAST model (US Army/Walter Reed)**: Biomathematical cognitive readiness prediction from sleep + circadian. Validated by FAA. CRS's direct academic ancestor.
- Borbely two-process model: Circadian + homeostatic sleep regulation
- **Altini, Dougherty et al. (2025)**: "Readiness, recovery, and strain: evaluation of composite health scores in consumer wearables." *Translational Exercise Biomedicine*. No commercial composite score is validated or algorithm-transparent.
- **Klasnja et al. (2018)**: Microrandomized trial — tailored push notifications increase engagement 4-12 percentage points. *JMIR mHealth*.
- **Figueroa et al. (2023)**: Notifications increase same-day engagement, effects diminish without content variation. *JMIR mHealth*.
- Schmidt et al. (2018): WESAD dataset (ICMI)
- Koldijk et al. (2014, 2018): SWELL-KW dataset
- Mundnich et al. (2020): TILES-2018 (Nature Scientific Data)
- Google PHIA (2025): Personal Health Information Agent
- kygo.app (2024-2025): 17-study wearable accuracy meta-analysis

---

*This document is the science behind Waldo. Share it with co-founders who want to understand what's proven, what's assumed, and where the intelligence roadmap goes.*
