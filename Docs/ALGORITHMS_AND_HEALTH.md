# OneSync -- Algorithms & Health Intelligence

Last updated: March 15, 2026

> CRS formula, HRV computation, stress detection, and all health algorithm details.
> Incorporates all March 7 corrections from the Tech Stack Deep Dive.

---

## Cognitive Readiness Score (CRS) -- Overview

A 0-100 composite score reflecting how prepared a person is to handle cognitive demands right now. Updated every 15 minutes when new data arrives. **Computed on-phone** (not server) for offline access, instant display, and privacy.

### Score Zones

| Range | Zone | Color | Meaning |
|-------|------|-------|---------|
| 80-100 | Peak | Teal (#2DD4BF) | Optimal cognitive state |
| 50-79 | Moderate | Amber (#F59E0B) | Functional but suboptimal |
| 0-49 | Low | Coral (#F87171) | Impaired, needs intervention |

---

## CRS Formula

```
CRS = (Sleep * 0.35) + (HRV * 0.25) + (Circadian * 0.25) + (Activity * 0.15)
```

### Weight Rationale (March 7 Corrected)

| Component | Weight | Why |
|-----------|--------|-----|
| Sleep | 35% | Most reliable signal across ALL wearables. Strongest predictor of next-day cognitive performance (military research consensus) |
| HRV | 25% | Best real-time autonomic indicator. Daytime wrist HRV too noisy for higher weight |
| Circadian | 25% | SAFTE model: 25%+ of performance variance from time-of-day alignment |
| Activity | 15% | Moderate effect, mostly contextual. Sweet spot matters but effect is smaller |

### Phase 3: Apple Watch SDNN Variant

Apple Watch reports **SDNN** (Standard Deviation of NN intervals), not RMSSD. Both measure HRV but via different calculations. When iOS/HealthKit support is added (Phase 3), the HRV component needs a parallel formula path:

```typescript
// Android (RMSSD from Health Connect or computed from raw IBI)
function hrvScore_rmssd(rmssd: number, baseline: number): number { ... }

// iOS (SDNN from HealthKit — Phase 3)
// SDNN ≈ RMSSD * 1.33 as rough conversion, but per-user calibration is better
function hrvScore_sdnn(sdnn: number, baseline: number): number { ... }
```

The CRS weights remain identical; only the normalization function changes. Track `hrv_metric_type: 'rmssd' | 'sdnn'` per user in the `users` table.

### Why Sleep-Heavy?

1. Sleep data is universal -- every wearable reports it to Health Connect
2. Sleep quality is the strongest predictor of next-day cognitive performance
3. HRV during sleep is more reliable than daytime HRV (fewer motion artifacts)
4. For Tier 3 (HC-only) devices, sleep is still meaningful even without HRV

### Show Component Breakdown (Like Oura)

Don't just show "CRS: 72". Show:
```
CRS: 72
  Sleep Recovery: 80 (good)
  HRV Balance: 65 (below baseline)
  Circadian Alignment: 75 (on track)
  Activity Balance: 70 (adequate)
```
Transparency builds trust and helps users understand what's affecting their score.

---

## Component Scoring (0-100 each)

### 1. Sleep Score (35%)

```typescript
function computeSleepScore(sleep: SleepData): number {
  let score = 100;

  // Duration (target: 7-9 hours)
  const hours = sleep.durationMinutes / 60;
  if (hours < 6) score -= (6 - hours) * 15;
  else if (hours < 7) score -= (7 - hours) * 8;
  else if (hours > 9.5) score -= (hours - 9.5) * 5;

  // Sleep stages (if available)
  if (sleep.deepMinutes !== undefined) {
    const deepPct = sleep.deepMinutes / sleep.durationMinutes;
    if (deepPct < 0.13) score -= 10;
    if (deepPct < 0.08) score -= 10;
  }

  if (sleep.remMinutes !== undefined) {
    const remPct = sleep.remMinutes / sleep.durationMinutes;
    if (remPct < 0.20) score -= 8;
  }

  // Efficiency (if available)
  if (sleep.efficiency !== undefined) {
    if (sleep.efficiency < 85) score -= (85 - sleep.efficiency) * 0.8;
  }

  // Consistency (bedtime regularity)
  if (sleep.bedtimeDeviationMinutes !== undefined) {
    if (sleep.bedtimeDeviationMinutes > 60) score -= 10;
    if (sleep.bedtimeDeviationMinutes > 120) score -= 10;
  }

  // [ADDED March 7] Cumulative sleep debt
  if (sleep.weeklyDebtHours !== undefined) {
    score -= Math.min(30, sleep.weeklyDebtHours * 5);
  }

  return Math.max(0, Math.min(100, score));
}
```

### [ADDED] Cumulative Sleep Debt Tracking

```
Target: 56h/week (8h/night)
Track rolling 7-day actual sleep
Per hour of accumulated deficit: -5 points from sleep debt sub-score
Floor at 20 (don't zero out)
Weight within Sleep component: 15% of the sleep score
```

### 2. HRV Score (25%)

```typescript
function computeHRVScore(
  currentRMSSD: number,
  baseline7Day: number,
  baseline30Day: number,
  age: number,
  currentHour: number,          // [ADDED March 7]
  timeOfDayRatios?: number[]    // [ADDED March 7]
): number {
  if (currentRMSSD < 0) return 50; // No valid HRV data, neutral

  // [ADDED March 7] Time-of-day normalization
  let adjustedBaseline = baseline7Day;
  if (timeOfDayRatios) {
    const blockIndex = Math.floor(currentHour / 4);
    adjustedBaseline = baseline7Day * timeOfDayRatios[blockIndex];
  }

  const deviation = (currentRMSSD - adjustedBaseline) / adjustedBaseline;

  let score = 60; // Start at "normal"

  // Deviation from adjusted baseline
  if (deviation > 0.10) score += 20;
  else if (deviation > 0) score += 10;
  else if (deviation > -0.10) score -= 5;
  else if (deviation > -0.20) score -= 15;
  else score -= 30;

  // Trend: compare 7-day to 30-day baseline
  const trend = (baseline7Day - baseline30Day) / baseline30Day;
  if (trend > 0.05) score += 10;
  else if (trend < -0.10) score -= 10;

  // Age-adjusted absolute floor
  const ageNorm = getAgeNormRMSSD(age);
  if (currentRMSSD < ageNorm * 0.5) score -= 15;

  return Math.max(0, Math.min(100, score));
}

function getAgeNormRMSSD(age: number): number {
  if (age < 25) return 42;
  if (age < 35) return 35;
  if (age < 45) return 30;
  if (age < 55) return 25;
  if (age < 65) return 22;
  return 18;
}
```

### [CRITICAL ADDITION] Time-of-Day HRV Normalization

HRV naturally dips in the afternoon. Without adjustment, comparing 3pm RMSSD to overnight baseline systematically triggers false stress alerts.

After 7+ days of data, compute per-user RMSSD patterns in 4-hour blocks:
```
00:00-04:00 (deep sleep):  ratio = 1.30
04:00-08:00 (waking):      ratio = 1.10
08:00-12:00 (morning):     ratio = 1.00 (reference)
12:00-16:00 (afternoon):   ratio = 0.85 (natural dip)
16:00-20:00 (evening):     ratio = 0.90
20:00-24:00 (pre-sleep):   ratio = 1.05

adjustedBaseline = overallBaseline * timeOfDayRatio[currentBlock]
```

### 3. Activity Score (15%)

```typescript
function computeActivityScore(activity: ActivityData): number {
  let score = 70;

  if (activity.stepsToday > 6000) score += 10;
  if (activity.stepsToday > 10000) score += 5;
  if (activity.stepsToday < 2000) score -= 15;

  if (activity.sedentaryMinutes !== undefined) {
    if (activity.sedentaryMinutes > 480) score -= 10;
    if (activity.sedentaryMinutes > 600) score -= 10;
  }

  if (activity.stepsLast2Hours !== undefined) {
    if (activity.stepsLast2Hours < 100) score -= 10;
    if (activity.stepsLast2Hours > 500) score += 5;
  }

  if (activity.exerciseMinutesToday > 20) score += 10;
  if (activity.exerciseMinutesToday > 60) score -= 5;

  return Math.max(0, Math.min(100, score));
}
```

### 4. Circadian Score (25%)

```typescript
function computeCircadianScore(
  currentHour: number,
  chronotype: 'early' | 'normal' | 'late',
  lastSleepEnd: Date,
  now: Date
): number {
  const hoursSinceWake = (now.getTime() - lastSleepEnd.getTime()) / 3600000;

  const peakWindows = {
    early:  { peak1: [8, 12], peak2: [15, 17], low: [13, 15], crash: 20 },
    normal: { peak1: [9, 13], peak2: [16, 18], low: [14, 16], crash: 22 },
    late:   { peak1: [11, 15], peak2: [18, 21], low: [15, 17], crash: 24 },
  };

  const windows = peakWindows[chronotype];
  let score = 60;

  if (inRange(currentHour, windows.peak1) || inRange(currentHour, windows.peak2)) {
    score += 25;
  } else if (inRange(currentHour, windows.low)) {
    score -= 10;
  } else if (currentHour >= windows.crash || currentHour < 5) {
    score -= 30;
  }

  if (hoursSinceWake > 16) score -= 20;
  else if (hoursSinceWake > 14) score -= 10;
  else if (hoursSinceWake < 1) score -= 5;

  return Math.max(0, Math.min(100, score));
}
```

### [ADDED] Chronotype Estimation (No Lab Test Needed)

```
midpointOfSleep = 14-day rolling average of (sleepStart + sleepEnd) / 2
  < 2:30 AM  -> "early" (alertness peak ~10am)
  2:30-4:00  -> "normal" (peak ~11:30am)
  > 4:00 AM  -> "late" (peak ~1pm)
```

---

## HRV Computation from Raw IBI

### [CORRECTED March 7] Artifact Rejection Pipeline

The original design deleted ectopic beats, which **biases RMSSD downward**. Corrected to interpolate:

```typescript
function computeRMSSD(ibiMs: number[]): number {
  // Step 1: Reject physiologically impossible values
  const clean = ibiMs.filter(v => v >= 300 && v <= 2000);

  // Step 2: [CORRECTED] Adaptive local median filter (5-point window)
  // Interpolate artifacts instead of deleting them
  const filtered = [...clean];
  for (let i = 2; i < clean.length - 2; i++) {
    const window = [clean[i-2], clean[i-1], clean[i], clean[i+1], clean[i+2]];
    const localMedian = median(window);
    if (Math.abs(clean[i] - localMedian) / localMedian > 0.25) {
      filtered[i] = localMedian; // Interpolate, don't delete
    }
  }

  // Step 3: [CORRECTED] Quality check -- if >20% artifacts, discard window
  const artifactCount = filtered.filter((v, i) => v !== clean[i]).length;
  if (artifactCount / clean.length > 0.20) return -1;

  // Step 4: Require minimum sample size (80% valid)
  if (filtered.length < 30) return -1;

  // Step 5: Compute RMSSD
  let sumSquaredDiffs = 0;
  for (let i = 1; i < filtered.length; i++) {
    sumSquaredDiffs += Math.pow(filtered[i] - filtered[i - 1], 2);
  }

  return Math.sqrt(sumSquaredDiffs / (filtered.length - 1));
}
```

### HRV Metric Selection

| Metric | Verdict |
|--------|---------|
| **RMSSD** | **PRIMARY -- 2-min windows, updated every 30s** |
| lnRMSSD | Use internally for statistics (log-normalizes skewed distribution) |
| SDNN | Skip (needs 5+ min, mixes sympathetic + parasympathetic) |
| pNN50 | Skip (r > 0.95 with RMSSD, adds no info) |
| LF/HF ratio | **NEVER USE -- scientifically debunked** (Billman 2013) |
| Frequency-domain | Skip for MVP |

### Data Sources for IBI

| Source | Sampling | Notes |
|--------|----------|-------|
| Samsung Sensor SDK | 1Hz, up to 4 IBI per reading | Continuous streaming |
| Garmin Connect IQ | IBI array | Via registerSensorDataListener(), requires foreground |
| Fitbit Web API | 5-min RMSSD (pre-computed) | Sleep only |
| WHOOP API | Single daily RMSSD | Pre-computed |
| Oura API | Nightly average RMSSD | Pre-computed |

### Baseline Computation

```typescript
// 7-day: exponential moving average (alpha = 0.3)
baseline7Day = 0.3 * newRMSSD + 0.7 * previousBaseline7Day;

// 30-day: simple moving average
baseline30Day = average(last30DaysRMSSD);
```

### Cold Start Improvement

**First night of sleep HRV as immediate personal baseline** (with wide confidence intervals that narrow as more nights accumulate). One night of real data >> any population norm.

---

## Stress Detection

### [CORRECTED March 7] Weighted Confidence Scoring

The original binary AND gate design fails entirely when any single signal is missing. Replaced with weighted confidence:

```typescript
function computeStressConfidence(
  hrvDropPercent: number | null,
  hrElevationPercent: number | null,
  persistMinutes: number,
  isExercising: boolean,
  stepCountRecent: number
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  // HRV component (weight 0.35)
  if (hrvDropPercent !== null) {
    const hrvScore = Math.min(hrvDropPercent / 30, 1);
    weightedSum += 0.35 * hrvScore;
    totalWeight += 0.35;
  }

  // HR component (weight 0.25)
  if (hrElevationPercent !== null) {
    const hrScore = Math.min(hrElevationPercent / 25, 1);
    weightedSum += 0.25 * hrScore;
    totalWeight += 0.25;
  }

  // Duration (weight 0.20)
  const durationScore = Math.min(persistMinutes / 15, 1);
  weightedSum += 0.20 * durationScore;
  totalWeight += 0.20;

  // Activity context (weight 0.20) -- inverted
  if (!isExercising && stepCountRecent < 200) {
    weightedSum += 0.20 * 1.0;
  } else if (!isExercising) {
    weightedSum += 0.20 * 0.5;
  }
  // If exercising, this component contributes 0
  totalWeight += 0.20;

  // Insufficient data guard
  if (totalWeight < 0.40) return 0;

  return weightedSum / totalWeight;
}
```

### Confidence Thresholds

| Confidence | Action |
|-----------|--------|
| >= 0.60 | **ALERT** -- trigger proactive message |
| 0.40-0.59 | **LOG** -- track but don't alert |
| < 0.40 | **IGNORE** |

### Benefits Over Binary Gates

- Handles missing data gracefully (if no HRV, still works with HR + duration + activity)
- More nuanced severity assessment
- Still fully explainable to users ("Your stress confidence was 0.72: HRV dropped 25%, HR up 18%, sustained 12 minutes")

### Severity Levels (Determines Model Routing)

```typescript
function classifySeverity(confidence: number): 'mild' | 'moderate' | 'high' {
  if (confidence > 0.80) return 'high';     // Opus model, immediate
  if (confidence > 0.60) return 'moderate'; // Sonnet model, gentle check-in
  return 'mild';                             // Haiku model, log only
}
```

### False Positive Reduction Strategy

1. **Personal baselines, not population norms**
2. **[ADDED] Time-of-day normalization** -- the single most impactful addition
3. **Weighted confidence scoring** -- handles missing signals
4. **Activity exclusion** -- step counter + exercise detection
5. **Temporal persistence** -- 10-minute minimum
6. **Cooldown period** -- 2 hours between alerts (was 30 min)
7. **User feedback loop** -- "Was this helpful?" adjusts thresholds
8. **[ADDED] Rules-based pre-filter** -- skip Claude entirely when everything is normal

---

## Adaptive Weight Adjustment

```typescript
function adjustWeights(
  userId: string,
  feedback: 'helpful' | 'not_helpful',
  crsComponents: Record<string, number>,
  currentWeights: Record<string, number>
) {
  // Requires minimum 10 feedback events before adjusting
  // Change rate: 0.02 per feedback (slow, stable)
  // Floor: no component below 0.10
  // Ceiling: no component above 0.50
  // Store per user in user_preferences table
  // Reset to defaults available in settings
}
```

---

## What Production Systems Teach Us

| System | Key Lesson |
|--------|-----------|
| **Garmin Body Battery** | Consider "battery" trajectory view alongside CRS snapshot |
| **WHOOP Recovery** | 30-day baselines more stable than 7-day. Falls back to sleep-only model |
| **Oura Readiness** | Component breakdown with color coding = trust |
| **Samsung Stress** | On-demand only, NOT continuous passive. Even Samsung doesn't trust passive daytime HRV |

**Implication:** Be conservative. Morning CRS (from overnight data) is most reliable. Daytime is supplementary.

---

## Algorithm Limitations (Honest Assessment)

1. **HRV is not a stress meter** -- reflects autonomic balance. Many things affect it besides psychological stress
2. **Circadian scoring is approximate** -- true chronotype requires weeks of data or genetic testing
3. **Sleep staging from wearables varies widely** -- Samsung and Oura are decent; budget wearables are poor
4. **No ground truth** -- user feedback is the only validation
5. **Cold start problem** -- first 7 days have limited personal baseline
6. **Caffeine, medication, alcohol** -- all affect HRV/HR independent of stress

---

## NOTES & RECOMMENDATIONS

### 1. Morning CRS vs Real-Time CRS
Consider a dual-score display: "Morning CRS" (from overnight data, most reliable, the "official" score) and "Live CRS" (updated every 15 min, shown with a confidence indicator). Stress alerts should only fire when confidence > 0.60 AND live CRS drops > 15 points from morning CRS. This reduces afternoon false alarms dramatically.

### 2. Confidence Intervals, Not Point Estimates
Show CRS as "72 +/- 8" rather than just "72" during the first 2 weeks. This manages expectations during the learning period and communicates uncertainty honestly. The interval narrows as more data accumulates.

### 3. Medication & Caffeine Context
Add optional self-report: "I had coffee" or "I took my medication" buttons. These events should suppress stress alerts for a configurable window (e.g., 45 min post-caffeine). This is low-effort, high-impact for false positive reduction.

### 4. Menstrual Cycle Awareness
HRV varies significantly across the menstrual cycle (lower in luteal phase). For users who opt in, track cycle phase and adjust baselines accordingly. This prevents systematic false stress alerts for half the population.

### 5. The "Everything Normal" Optimization
The rules-based pre-filter (CRS > 60 AND stress confidence < 0.3 => skip Claude) saves 60-80% of AI costs. Most 15-minute checks show normal readings. This is the single biggest cost optimization in the entire system.

### 6. CRS Validation Path
The algorithm claims are currently theoretical. See NOTES_AND_RECOMMENDATIONS.md for the full IIT Ropar validation study design (50-person, 30-day study with PVT + N-back + salivary cortisol ground truths).

### 7. RMSSD Distribution is Log-Normal
Use lnRMSSD internally for all statistical operations (baseline computation, deviation calculation, trend analysis). Convert back to RMSSD only for display. This prevents high-HRV individuals from having systematically different alert sensitivity than low-HRV individuals.

### 8. References
- Task Force of ESC/NASPE (1996): HRV measurement standards
- Billman (2013): LF/HF ratio debunking
- Shaffer & Ginsberg (2017): HRV overview
- Kim et al. (2018): HRV-stress meta-analysis
- SAFTE-FAST model: Military cognitive readiness
- Castaldo et al. (2015): Acute mental stress and HRV
