/**
 * CRS (Cognitive Readiness Score) computation engine.
 *
 * Formula: CRS = (Sleep × 0.35) + (HRV × 0.25) + (Circadian × 0.25) + (Activity × 0.15)
 * Each component: 0-100. Composite: 0-100. Insufficient data: -1.
 *
 * Grounded in SAFTE-FAST (US Army). Consumer name: "Nap Score".
 */
import type { DailyHealthData } from '../types/health.js';
import type { CrsResult, ComponentScore, Baselines } from '../types/crs.js';
import { CRS_WEIGHTS, getCrsZone, getTimeOfDayRatio } from '../types/crs.js';
import { computeBaselines } from './baseline-calculator.js';

/** Clamp a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

// ─── SLEEP SCORE (35%) ────────────────────────────────────────────────

function computeSleepScore(day: DailyHealthData, baselines: Baselines): ComponentScore {
  const sleep = day.sleep;
  if (!sleep) {
    return { score: 0, factors: ['No sleep data'], dataAvailable: false };
  }

  let score = 100;
  const factors: string[] = [];
  const durationHours = sleep.totalDurationMinutes / 60;

  // Duration: target 7-9h
  if (durationHours < 6) {
    const deficit = 6 - durationHours;
    const penalty = deficit * 15; // -15 per hour below 6
    score -= penalty;
    factors.push(`Short sleep: ${durationHours.toFixed(1)}h (-${penalty.toFixed(0)})`);
  } else if (durationHours < 7) {
    const penalty = (7 - durationHours) * 10;
    score -= penalty;
    factors.push(`Below target: ${durationHours.toFixed(1)}h (-${penalty.toFixed(0)})`);
  } else if (durationHours > 9.5) {
    score -= 5;
    factors.push(`Oversleep: ${durationHours.toFixed(1)}h (-5)`);
  } else {
    factors.push(`Good duration: ${durationHours.toFixed(1)}h`);
  }

  // Deep sleep: < 13% → -10, < 8% → -20
  if (sleep.deepPercent < 0.08) {
    score -= 20;
    factors.push(`Very low deep: ${(sleep.deepPercent * 100).toFixed(0)}% (-20)`);
  } else if (sleep.deepPercent < 0.13) {
    score -= 10;
    factors.push(`Low deep: ${(sleep.deepPercent * 100).toFixed(0)}% (-10)`);
  }

  // REM sleep: < 20% → -8
  if (sleep.remPercent < 0.20) {
    score -= 8;
    factors.push(`Low REM: ${(sleep.remPercent * 100).toFixed(0)}% (-8)`);
  }

  // Sleep efficiency: < 85% → proportional penalty
  if (sleep.efficiency < 0.85) {
    const penalty = Math.round((0.85 - sleep.efficiency) * 100);
    score -= penalty;
    factors.push(`Low efficiency: ${(sleep.efficiency * 100).toFixed(0)}% (-${penalty})`);
  }

  // Bedtime consistency: compare to 7d average
  if (baselines.bedtime7d !== null && sleep.bedtime) {
    const bedMinutes = sleep.bedtime.getHours() * 60 + sleep.bedtime.getMinutes();
    const adjustedBed = bedMinutes > 720 ? bedMinutes - 1440 : bedMinutes;
    const deviation = Math.abs(adjustedBed - baselines.bedtime7d);
    if (deviation > 120) {
      score -= 20;
      factors.push(`Bedtime shift: ${deviation.toFixed(0)}min (-20)`);
    } else if (deviation > 60) {
      score -= 10;
      factors.push(`Bedtime shift: ${deviation.toFixed(0)}min (-10)`);
    }
  }

  // Cumulative sleep debt (7-day rolling): -5 per hour, max -30
  if (baselines.sleepDuration7d !== null) {
    const targetMinutes = 7.5 * 60; // 7.5h target
    const avgMinutes = baselines.sleepDuration7d;
    if (avgMinutes < targetMinutes) {
      const debtHours = (targetMinutes - avgMinutes) / 60;
      const penalty = Math.min(30, Math.round(debtHours * 5));
      score -= penalty;
      factors.push(`Sleep debt: ${debtHours.toFixed(1)}h avg deficit (-${penalty})`);
    }
  }

  return { score: clamp(score, 0, 100), factors, dataAvailable: true };
}

// ─── HRV SCORE (25%) ──────────────────────────────────────────────────

function computeHrvScore(day: DailyHealthData, baselines: Baselines): ComponentScore {
  if (day.hrvReadings.length === 0) {
    return { score: 50, factors: ['No HRV data — neutral score'], dataAvailable: false };
  }

  const factors: string[] = [];

  // Get today's mean RMSSD (prefer RMSSD, fall back to SDNN)
  const rmssdValues = day.hrvReadings
    .map(r => r.rmssd)
    .filter((v): v is number => v !== null);
  const sdnnValues = day.hrvReadings.map(r => r.sdnn);

  const todayHrv = rmssdValues.length > 0
    ? rmssdValues.reduce((s, v) => s + v, 0) / rmssdValues.length
    : sdnnValues.reduce((s, v) => s + v, 0) / sdnnValues.length;

  const usingRmssd = rmssdValues.length > 0;
  factors.push(`${usingRmssd ? 'RMSSD' : 'SDNN'}: ${todayHrv.toFixed(1)}ms`);

  // Apply time-of-day normalization to each reading
  const normalizedReadings = day.hrvReadings.map(r => {
    const hour = r.timestamp.getHours();
    const ratio = getTimeOfDayRatio(hour);
    const rawValue = r.rmssd ?? r.sdnn;
    return rawValue / ratio; // Normalize to morning-equivalent
  });
  const normalizedMean = normalizedReadings.reduce((s, v) => s + v, 0) / normalizedReadings.length;

  // Compare to 7-day baseline
  let score = 70; // Start at moderate-good
  if (baselines.hrv7d !== null) {
    const deviation = (normalizedMean - baselines.hrv7d) / baselines.hrv7d;

    if (deviation > 0.15) {
      score = 90; // Significantly above baseline
      factors.push(`+${(deviation * 100).toFixed(0)}% above 7d baseline`);
    } else if (deviation > 0.05) {
      score = 80;
      factors.push(`+${(deviation * 100).toFixed(0)}% above baseline`);
    } else if (deviation > -0.05) {
      score = 70; // Within normal range
      factors.push('Within baseline range');
    } else if (deviation > -0.15) {
      score = 50;
      factors.push(`${(deviation * 100).toFixed(0)}% below baseline`);
    } else if (deviation > -0.25) {
      score = 35;
      factors.push(`${(deviation * 100).toFixed(0)}% below baseline (significant)`);
    } else {
      score = 20;
      factors.push(`${(deviation * 100).toFixed(0)}% below baseline (severe)`);
    }
  } else {
    factors.push('No baseline yet — using raw value');
    // Without baseline, score based on absolute value (age-adjusted)
    // For a ~21yo male, healthy RMSSD range: 30-80ms
    if (todayHrv > 60) score = 85;
    else if (todayHrv > 40) score = 70;
    else if (todayHrv > 25) score = 50;
    else score = 30;
  }

  // Trend: 7d vs 30d baseline
  if (baselines.hrv7d !== null && baselines.hrv30d !== null) {
    const trend = (baselines.hrv7d - baselines.hrv30d) / baselines.hrv30d;
    if (trend > 0.10) {
      score += 5;
      factors.push('Improving trend (+5)');
    } else if (trend < -0.10) {
      score -= 5;
      factors.push('Declining trend (-5)');
    }
  }

  return { score: clamp(score, 0, 100), factors, dataAvailable: true };
}

// ─── CIRCADIAN SCORE (25%) ────────────────────────────────────────────

function computeCircadianScore(day: DailyHealthData, baselines: Baselines): ComponentScore {
  const factors: string[] = [];

  // We need sleep data to know wake time
  if (!day.sleep) {
    return { score: 50, factors: ['No sleep data — neutral circadian'], dataAvailable: false };
  }

  let score = 80; // Default good

  // Peak performance window based on chronotype
  const chronotype = baselines.chronotype;
  const peakHour = chronotype === 'early' ? 10 : chronotype === 'normal' ? 11.5 : 13;
  factors.push(`Chronotype: ${chronotype} (peak ~${peakHour}:00)`);

  // Hours since wake — crashes after 14-16h
  const wakeTime = day.sleep.wakeTime;
  const wakeHour = wakeTime.getHours() + wakeTime.getMinutes() / 60;

  // Score based on how well sleep timing aligns with circadian rhythm
  // Early risers who are consistent get higher scores
  const idealWake = chronotype === 'early' ? 6 : chronotype === 'normal' ? 7.5 : 9;
  const wakeDeviation = Math.abs(wakeHour - idealWake);

  if (wakeDeviation < 1) {
    score = 90;
    factors.push(`Wake time ${wakeHour.toFixed(1)}h — well aligned`);
  } else if (wakeDeviation < 2) {
    score = 75;
    factors.push(`Wake time ${wakeHour.toFixed(1)}h — slightly off`);
  } else {
    score = 55;
    factors.push(`Wake time ${wakeHour.toFixed(1)}h — misaligned`);
  }

  // Bedtime consistency affects circadian rhythm
  if (baselines.bedtime7d !== null && day.sleep.bedtime) {
    const bedMinutes = day.sleep.bedtime.getHours() * 60 + day.sleep.bedtime.getMinutes();
    const adjustedBed = bedMinutes > 720 ? bedMinutes - 1440 : bedMinutes;
    const deviation = Math.abs(adjustedBed - baselines.bedtime7d);
    if (deviation > 90) {
      score -= 15;
      factors.push(`Irregular bedtime (${deviation.toFixed(0)}min shift, -15)`);
    }
  }

  return { score: clamp(score, 0, 100), factors, dataAvailable: true };
}

// ─── ACTIVITY SCORE (15%) ─────────────────────────────────────────────

function computeActivityScore(day: DailyHealthData): ComponentScore {
  const factors: string[] = [];
  let score = 60; // Moderate default

  const steps = day.totalSteps;
  const exerciseMin = day.exerciseMinutes;

  if (steps === 0 && exerciseMin === 0 && !day.activitySummary) {
    return { score: 50, factors: ['No activity data'], dataAvailable: false };
  }

  // Steps scoring
  if (steps >= 10000) {
    score = 90;
    factors.push(`Steps: ${steps.toLocaleString()} (excellent)`);
  } else if (steps >= 6000) {
    score = 75;
    factors.push(`Steps: ${steps.toLocaleString()} (good)`);
  } else if (steps >= 2000) {
    score = 55;
    factors.push(`Steps: ${steps.toLocaleString()} (low)`);
  } else if (steps > 0) {
    score = 35;
    factors.push(`Steps: ${steps.toLocaleString()} (very low)`);
  }

  // Exercise bonus/penalty
  if (exerciseMin >= 20 && exerciseMin <= 60) {
    score += 10;
    factors.push(`Exercise: ${Math.round(exerciseMin)}min (+10 bonus)`);
  } else if (exerciseMin > 60) {
    score -= 5;
    factors.push(`Heavy exercise: ${Math.round(exerciseMin)}min (-5 overtraining signal)`);
  }

  // Sedentary check from activity summary
  if (day.activitySummary) {
    const standHours = day.activitySummary.appleStandHours;
    if (standHours < 6) {
      score -= 10;
      factors.push(`Low stand hours: ${standHours}h (-10)`);
    }
  }

  return { score: clamp(score, 0, 100), factors, dataAvailable: true };
}

// ─── COMPOSITE CRS ────────────────────────────────────────────────────

/**
 * Compute CRS for a single day.
 * Requires baselines from prior days.
 */
export function computeCrs(
  day: DailyHealthData,
  allDays: Map<string, DailyHealthData>,
): CrsResult {
  const baselines = computeBaselines(day.date, allDays);

  const sleep = computeSleepScore(day, baselines);
  const hrv = computeHrvScore(day, baselines);
  const circadian = computeCircadianScore(day, baselines);
  const activity = computeActivityScore(day);

  const components = [sleep, hrv, circadian, activity];
  const withData = components.filter(c => c.dataAvailable);

  // Need ≥ 3 components with real data
  if (withData.length < 3) {
    return {
      score: -1,
      zone: 'low',
      sleep,
      hrv,
      circadian,
      activity,
      componentsWithData: withData.length,
      confidence: 0,
      timestamp: day.sleep?.wakeTime ?? new Date(day.date),
      summary: `Insufficient data (${withData.length}/4 components). Need ≥3 for CRS.`,
    };
  }

  // If a component lacks data, redistribute its weight proportionally
  let totalWeight = 0;
  let weightedSum = 0;
  const weights = [CRS_WEIGHTS.sleep, CRS_WEIGHTS.hrv, CRS_WEIGHTS.circadian, CRS_WEIGHTS.activity];

  for (let i = 0; i < components.length; i++) {
    if (components[i]!.dataAvailable) {
      totalWeight += weights[i]!;
      weightedSum += components[i]!.score * weights[i]!;
    }
  }

  const score = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0);
  const zone = getCrsZone(score);

  // Confidence: wider with less data, narrower with more history
  const confidence = baselines.daysOfData >= 7 ? 5 : baselines.daysOfData >= 3 ? 8 : 15;

  const summary = buildSummary(score, zone, sleep, hrv, circadian, activity, day);

  return {
    score,
    zone,
    sleep,
    hrv,
    circadian,
    activity,
    componentsWithData: withData.length,
    confidence,
    timestamp: day.sleep?.wakeTime ?? new Date(day.date),
    summary,
  };
}

function buildSummary(
  score: number,
  zone: string,
  _sleep: ComponentScore,
  _hrv: ComponentScore,
  _circadian: ComponentScore,
  _activity: ComponentScore,
  day: DailyHealthData,
): string {
  const parts: string[] = [];

  parts.push(`CRS ${score} (${zone})`);

  if (day.sleep) {
    const hours = (day.sleep.totalDurationMinutes / 60).toFixed(1);
    parts.push(`Sleep: ${hours}h`);
  }

  if (day.hrvReadings.length > 0) {
    const avgHrv = day.hrvReadings.reduce((s, r) => s + (r.rmssd ?? r.sdnn), 0) / day.hrvReadings.length;
    parts.push(`HRV: ${avgHrv.toFixed(0)}ms`);
  }

  if (day.totalSteps > 0) {
    parts.push(`Steps: ${day.totalSteps.toLocaleString()}`);
  }

  return parts.join(' | ');
}

/**
 * Compute CRS for all days in the dataset.
 * Returns a map of date → CrsResult.
 */
export function computeAllCrs(days: Map<string, DailyHealthData>): Map<string, CrsResult> {
  const results = new Map<string, CrsResult>();
  const sortedDates = [...days.keys()].sort();

  for (const date of sortedDates) {
    const day = days.get(date)!;
    results.set(date, computeCrs(day, days));
  }

  return results;
}
