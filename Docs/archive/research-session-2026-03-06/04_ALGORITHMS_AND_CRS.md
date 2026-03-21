# OneSync — Algorithms & Cognitive Readiness Score (CRS)

Last updated: March 6, 2026

---

## Cognitive Readiness Score (CRS) — Overview

A 0-100 composite score reflecting how prepared a person is to handle cognitive demands right now. Updated every 15 minutes when new data arrives.

### Score Zones

| Range | Zone | Color | Meaning |
|-------|------|-------|---------|
| 80-100 | Peak | Teal (#2DD4BF) | Optimal cognitive state |
| 50-79 | Moderate | Amber (#F59E0B) | Functional but suboptimal |
| 0-49 | Low | Coral (#F87171) | Impaired, needs intervention |

Colors chosen for accessibility (colorblind-safe, not red/green).

---

## CRS Formula

```
CRS = (Sleep * 0.35) + (HRV * 0.25) + (Activity * 0.20) + (Circadian * 0.20)
```

### Weight Rationale

| Component | Weight | Why |
|-----------|--------|-----|
| Sleep | 35% | Most reliable signal across ALL wearables. Every device reports sleep. Poor sleep = guaranteed cognitive impairment. |
| HRV | 25% | Best real-time autonomic nervous system indicator. Available from Samsung Sensor SDK, Garmin Connect IQ, and cloud APIs. |
| Activity | 20% | Movement patterns affect cognition. Sedentary too long = decline. Over-exertion = decline. Sweet spot matters. |
| Circadian | 20% | Time-of-day alignment with personal chronotype. Same biometrics at 3AM vs 10AM mean very different things. |

### Why Sleep-Heavy?

1. Sleep data is universal — every wearable reports it to Health Connect
2. Sleep quality is the strongest predictor of next-day cognitive performance (literature consensus)
3. HRV during sleep is more reliable than daytime HRV (fewer motion artifacts)
4. For users with Tier 3 (HC-only) devices, sleep is still meaningful even without HRV

---

## Component Scoring (0-100 each)

### 1. Sleep Score (35%)

```typescript
function computeSleepScore(sleep: SleepData): number {
  let score = 100;

  // Duration (target: 7-9 hours)
  const hours = sleep.durationMinutes / 60;
  if (hours < 6) score -= (6 - hours) * 15;       // -15 per hour under 6
  else if (hours < 7) score -= (7 - hours) * 8;   // -8 per hour under 7
  else if (hours > 9.5) score -= (hours - 9.5) * 5; // slight penalty for oversleep

  // Sleep stages (if available)
  if (sleep.deepMinutes !== undefined) {
    const deepPct = sleep.deepMinutes / sleep.durationMinutes;
    if (deepPct < 0.13) score -= 10;  // Below 13% deep sleep
    if (deepPct < 0.08) score -= 10;  // Below 8% is worse
  }

  if (sleep.remMinutes !== undefined) {
    const remPct = sleep.remMinutes / sleep.durationMinutes;
    if (remPct < 0.20) score -= 8;   // Below 20% REM
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

  return Math.max(0, Math.min(100, score));
}
```

### 2. HRV Score (25%)

```typescript
function computeHRVScore(
  currentRMSSD: number,
  baseline7Day: number,
  baseline30Day: number,
  age: number
): number {
  if (currentRMSSD < 0) return 50; // No valid HRV data, neutral score

  // Personal baseline comparison (most important)
  const deviationFrom7Day = (currentRMSSD - baseline7Day) / baseline7Day;

  let score = 60; // Start at "normal"

  // Deviation from 7-day baseline
  if (deviationFrom7Day > 0.10) score += 20;      // 10%+ above baseline = great
  else if (deviationFrom7Day > 0) score += 10;     // Slightly above = good
  else if (deviationFrom7Day > -0.10) score -= 5;  // Slightly below = mild concern
  else if (deviationFrom7Day > -0.20) score -= 15; // 10-20% below = concerning
  else score -= 30;                                 // 20%+ below = significant drop

  // Trend: compare 7-day to 30-day baseline
  const trend = (baseline7Day - baseline30Day) / baseline30Day;
  if (trend > 0.05) score += 10;      // Improving trend
  else if (trend < -0.10) score -= 10; // Declining trend

  // Age-adjusted absolute floor (population norms)
  const ageNorm = getAgeNormRMSSD(age);
  if (currentRMSSD < ageNorm * 0.5) score -= 15; // Far below age norm

  return Math.max(0, Math.min(100, score));
}

function getAgeNormRMSSD(age: number): number {
  // Approximate population median RMSSD by age
  if (age < 25) return 42;
  if (age < 35) return 35;
  if (age < 45) return 30;
  if (age < 55) return 25;
  if (age < 65) return 22;
  return 18;
}
```

### 3. Activity Score (20%)

```typescript
function computeActivityScore(activity: ActivityData): number {
  let score = 70; // Start at "moderate"

  // Steps (target: 6000-12000 for cognitive benefit)
  if (activity.stepsToday > 6000) score += 10;
  if (activity.stepsToday > 10000) score += 5;
  if (activity.stepsToday < 2000) score -= 15;

  // Sedentary time (if available)
  if (activity.sedentaryMinutes !== undefined) {
    if (activity.sedentaryMinutes > 480) score -= 10; // 8+ hours sedentary
    if (activity.sedentaryMinutes > 600) score -= 10; // 10+ hours
  }

  // Recent movement (last 2 hours)
  if (activity.stepsLast2Hours !== undefined) {
    if (activity.stepsLast2Hours < 100) score -= 10; // Very sedentary recently
    if (activity.stepsLast2Hours > 500) score += 5;  // Active recently
  }

  // Exercise today (moderate exercise boosts cognition)
  if (activity.exerciseMinutesToday > 20) score += 10;
  if (activity.exerciseMinutesToday > 60) score -= 5; // Diminishing returns / fatigue

  return Math.max(0, Math.min(100, score));
}
```

### 4. Circadian Score (20%)

```typescript
function computeCircadianScore(
  currentHour: number,
  chronotype: 'early' | 'normal' | 'late',
  lastSleepEnd: Date,
  now: Date
): number {
  // Hours since waking
  const hoursSinceWake = (now.getTime() - lastSleepEnd.getTime()) / 3600000;

  // Peak cognitive windows by chronotype
  const peakWindows = {
    early:  { peak1: [8, 12], peak2: [15, 17], low: [13, 15], crash: 20 },
    normal: { peak1: [9, 13], peak2: [16, 18], low: [14, 16], crash: 22 },
    late:   { peak1: [11, 15], peak2: [18, 21], low: [15, 17], crash: 24 },
  };

  const windows = peakWindows[chronotype];
  let score = 60;

  // In peak window?
  if (inRange(currentHour, windows.peak1) || inRange(currentHour, windows.peak2)) {
    score += 25;
  }
  // In post-lunch dip?
  else if (inRange(currentHour, windows.low)) {
    score -= 10;
  }
  // Past crash time?
  else if (currentHour >= windows.crash || currentHour < 5) {
    score -= 30;
  }

  // Sleep pressure (hours awake)
  if (hoursSinceWake > 16) score -= 20;      // Beyond normal wake period
  else if (hoursSinceWake > 14) score -= 10; // Getting late
  else if (hoursSinceWake < 1) score -= 5;   // Sleep inertia

  return Math.max(0, Math.min(100, score));
}
```

---

## HRV Computation from Raw IBI

### The Core Algorithm

When receiving raw inter-beat intervals (IBI) from Samsung Sensor SDK or Garmin Connect IQ, compute RMSSD (Root Mean Square of Successive Differences):

```typescript
function computeRMSSD(ibiMs: number[]): number {
  // Step 1: Reject physiologically impossible values
  const clean = ibiMs.filter(v => v >= 300 && v <= 2000);
  // 300ms = 200bpm max, 2000ms = 30bpm min

  // Step 2: Remove ectopic beats (successive difference > 20%)
  const filtered = [clean[0]];
  for (let i = 1; i < clean.length; i++) {
    if (Math.abs(clean[i] - clean[i - 1]) / clean[i - 1] < 0.20) {
      filtered.push(clean[i]);
    }
  }

  // Step 3: Require minimum sample size
  if (filtered.length < 30) return -1; // Not enough valid beats

  // Step 4: Compute RMSSD
  let sumSquaredDiffs = 0;
  for (let i = 1; i < filtered.length; i++) {
    sumSquaredDiffs += Math.pow(filtered[i] - filtered[i - 1], 2);
  }

  return Math.sqrt(sumSquaredDiffs / (filtered.length - 1));
}
```

### Artifact Rejection Details

| Filter | Threshold | Reason |
|--------|-----------|--------|
| Min IBI | 300ms | Heart rate above 200bpm is pathological |
| Max IBI | 2000ms | Heart rate below 30bpm is pathological |
| Ectopic removal | >20% successive difference | Premature beats cause IBI spikes |
| Minimum count | 30 valid IBIs | Statistical reliability |

### Data Sources for IBI

| Source | Sampling | Notes |
|--------|----------|-------|
| Samsung Sensor SDK | 1Hz, up to 4 IBI values per reading | Continuous streaming while tracker active |
| Garmin Connect IQ | `heartBeatIntervals` array | Via `registerSensorDataListener()`, requires foreground app |
| Fitbit Web API | 5-min RMSSD windows (pre-computed) | Sleep only, no raw IBI |
| WHOOP API | Single daily RMSSD value | Pre-computed, one per day |
| Oura API | Nightly average RMSSD | Pre-computed |

### Baseline Computation

```typescript
function updateBaselines(userId: string, newRMSSD: number) {
  // Rolling 7-day baseline (weighted recent)
  // Rolling 30-day baseline (equal weight)
  // Store in health_baselines table
  // Update on every valid RMSSD computation

  // 7-day: exponential moving average (alpha = 0.3)
  baseline7Day = 0.3 * newRMSSD + 0.7 * previousBaseline7Day;

  // 30-day: simple moving average
  baseline30Day = average(last30DaysRMSSD);
}
```

---

## Stress Detection — Multi-Signal Gate

### Why Multi-Signal?

Single-signal stress detection has unacceptable false positive rates:
- HRV drops during exercise, caffeine, standing up, dehydration
- HR elevates during movement, excitement, anticipation
- Single readings have high variance

### The Gate: ALL conditions must be true

```typescript
interface StressTrigger {
  hrvDropPercent: number;    // vs personal baseline
  hrElevatedPercent: number; // vs resting HR
  persistMinutes: number;    // duration of signal
  isExercising: boolean;     // from activity recognition
  stepCountRecent: number;   // last 10 minutes
  minutesSinceLastAlert: number;
}

function isStressConfirmed(t: StressTrigger): boolean {
  return (
    t.hrvDropPercent > 20 &&           // HRV dropped >20% from baseline
    t.hrElevatedPercent > 15 &&        // HR elevated >15% above resting
    t.persistMinutes >= 10 &&          // Sustained for 10+ minutes
    !t.isExercising &&                 // NOT during exercise
    t.stepCountRecent < 200 &&         // NOT walking/moving a lot
    t.minutesSinceLastAlert >= 30      // Cooldown: no alert spam
  );
}
```

### Gate Conditions Explained

| Condition | Threshold | Why |
|-----------|-----------|-----|
| HRV drop | >20% below baseline | Less than 20% is normal variation |
| HR elevation | >15% above resting | Less than 15% could be posture change, mild caffeine |
| Persistence | 10+ minutes | Momentary spikes are noise (standing up, startle reflex) |
| NOT exercising | Activity type check | Exercise causes identical HRV/HR patterns |
| Low step count | <200 steps in 10 min | Walking/climbing stairs elevate HR without stress |
| Cooldown | 30 minutes | Prevent notification fatigue |

### Severity Levels

```typescript
function computeStressSeverity(
  hrvDropPercent: number,
  hrElevatedPercent: number,
  persistMinutes: number
): 'mild' | 'moderate' | 'high' {
  const score = (hrvDropPercent * 0.4) + (hrElevatedPercent * 0.3) + (persistMinutes * 0.3);

  if (score > 50) return 'high';       // Opus model, immediate intervention
  if (score > 30) return 'moderate';   // Sonnet model, gentle check-in
  return 'mild';                        // Haiku model, log only, no message
}
```

### False Positive Reduction Strategy

1. **Personal baselines, not population norms** — Your 20% drop matters more than absolute values
2. **Multi-signal gating** — Requires concordance across HRV + HR + duration + context
3. **Activity exclusion** — Step counter and exercise detection filter out physical stress
4. **Temporal persistence** — 10-minute minimum filters transient spikes
5. **Cooldown period** — 30 minutes between alerts prevents notification fatigue
6. **User feedback loop** — "Was this helpful?" button adjusts thresholds per user over time

---

## Adaptive Weight Adjustment

Over time, learn which CRS components best predict user-reported states:

```typescript
// After user feedback on an intervention
function adjustWeights(
  userId: string,
  feedback: 'helpful' | 'not_helpful',
  crsComponents: { sleep: number; hrv: number; activity: number; circadian: number },
  currentWeights: { sleep: number; hrv: number; activity: number; circadian: number }
) {
  if (feedback === 'not_helpful') {
    // Find which component contributed most to the alert
    // Slightly reduce its weight, redistribute to others
    // Change rate: 0.02 per feedback (slow, stable)
    // Floor: no component below 0.10
    // Ceiling: no component above 0.50
  }

  // Store adjusted weights in user_preferences
  // Requires minimum 10 feedback events before adjusting
}
```

### Constraints

- No component weight below 10% or above 50%
- Adjustment rate: 2% per feedback event
- Minimum 10 feedback events before any adjustment
- Weights stored per user in `user_preferences` table
- Reset to defaults available in settings

---

## Algorithm Limitations (Honest Assessment)

1. **HRV is not a stress meter** — It reflects autonomic balance. Many things affect it besides psychological stress.
2. **Circadian scoring is approximate** — True chronotype requires weeks of data or genetic testing (PER3 gene).
3. **Sleep staging from wearables varies widely** — Samsung and Oura are decent; budget wearables are poor.
4. **No ground truth** — We never truly know if someone is stressed. User feedback is the only validation.
5. **Cold start problem** — First 7 days have no personal baseline. Use age-based population norms as fallback.
6. **Caffeine, medication, alcohol** — All affect HRV/HR independent of stress. Not accounted for (could add self-report).

### Mitigation

- **Conservative defaults** — Better to miss a stress event than to cry wolf
- **User feedback loop** — Continuously calibrates to individual
- **Transparency** — Show users what triggered an alert, not just a score
- **Grace period** — First week is "learning mode" with no proactive alerts
