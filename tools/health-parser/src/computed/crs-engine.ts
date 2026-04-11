/**
 * CRS (Cognitive Readiness Score) computation engine.
 *
 * Formula: CRS = (Recovery Score × 0.50) + (CASS × 0.35) + (ILAS × 0.15)
 *
 * UI exposes 4 components mapped from 3 pillars:
 *   Sleep  → Recovery Score (0.50): SSQ + RRS + SpO2 + WristTemp
 *   HRV    → CASS              (0.35): HRVS (Z-score) + RHRTS + WHAS
 *   Circadian → ILAS part      (0.075): Wake alignment + DAS
 *   Activity  → ILAS part      (0.075): EES + Steps/Motion
 *
 * Consumer name: "Form" / "Nap Score". Grounded in SAFTE-FAST (US Army).
 */
import type { DailyHealthData } from '../types/health.js';
import type { CrsResult, ComponentScore, Baselines, PillarDrag } from '../types/crs.js';
import { CRS_WEIGHTS, getCrsZone, getTimeOfDayRatio } from '../types/crs.js';
import { computeBaselines } from './baseline-calculator.js';

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ─── PILLAR 1: RECOVERY SCORE (Sleep component, 0.50 weight) ──────────────
//
// Recovery Score = (SSQ × 0.50) + (RRS × 0.20) + (SO2S × 0.20) + (WTS × 0.10)
// Spec: measures what happened to the body during last night's sleep.

function computeSSQ(day: DailyHealthData, baselines: Baselines): { score: number; factors: string[] } {
  const sleep = day.sleep;
  if (!sleep) return { score: 50, factors: ['No sleep data'] };

  let score = 100;
  const factors: string[] = [];
  const durationHours = sleep.totalDurationMinutes / 60;

  // ── Duration penalty ───────────────────────────────────────────
  if (durationHours < 6) {
    const penalty = Math.min(50, (6 - durationHours) * 15);
    score -= penalty;
    factors.push(`Short: ${durationHours.toFixed(1)}h (-${penalty.toFixed(0)})`);
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

  // ── Deep sleep: target 13–23% of TST ──────────────────────────
  const deepPct = sleep.deepPercent * 100;
  if (deepPct < 8) {
    score -= 20;
    factors.push(`Very low deep: ${deepPct.toFixed(0)}% (-20)`);
  } else if (deepPct < 13) {
    const penalty = Math.round(((13 - deepPct) / 13) * 20);
    score -= penalty;
    factors.push(`Low deep: ${deepPct.toFixed(0)}% (-${penalty})`);
  }

  // ── REM: target 20–25% ────────────────────────────────────────
  const remPct = sleep.remPercent * 100;
  if (remPct < 20) {
    const penalty = Math.round((1 - remPct / 20) * 8);
    score -= penalty;
    factors.push(`Low REM: ${remPct.toFixed(0)}% (-${penalty})`);
  }

  // ── Sleep efficiency: target ≥85% ─────────────────────────────
  const effPct = sleep.efficiency * 100;
  if (effPct < 85) {
    const penalty = Math.ceil((85 - effPct));
    score -= penalty;
    factors.push(`Low efficiency: ${effPct.toFixed(0)}% (-${penalty})`);
  }

  // ── Bedtime consistency ────────────────────────────────────────
  if (baselines.bedtime7d !== null && sleep.bedtime) {
    const bedMin = sleep.bedtime.getHours() * 60 + sleep.bedtime.getMinutes();
    const adjusted = bedMin > 720 ? bedMin - 1440 : bedMin;
    const deviation = Math.abs(adjusted - baselines.bedtime7d);
    if (deviation > 120) { score -= 20; factors.push(`Bedtime +${deviation.toFixed(0)}min late (-20)`); }
    else if (deviation > 60) { score -= 10; factors.push(`Bedtime +${deviation.toFixed(0)}min late (-10)`); }
  }

  // ── Sleep debt penalty (max -30) ──────────────────────────────
  if (baselines.sleepDuration7d !== null) {
    const targetMin = 7.5 * 60;
    const avgMin = baselines.sleepDuration7d;
    if (avgMin < targetMin) {
      const debtHours = (targetMin - avgMin) / 60;
      const penalty = Math.min(30, Math.round(debtHours * 5));
      score -= penalty;
      factors.push(`Sleep debt: ${debtHours.toFixed(1)}h deficit (-${penalty})`);
    }
  }

  return { score: clamp(score, 0, 100), factors };
}

function computeRRS(day: DailyHealthData): { score: number; factors: string[] } {
  const readings = day.respiratoryReadings ?? [];
  const values = readings.map(r => r.breathsPerMinute).filter(v => v > 0);
  const med = median(values);

  if (med === null) return { score: 100, factors: ['No respiratory rate data — neutral'] };

  let score: number;
  const f = `Resp rate: ${med.toFixed(1)} brpm`;

  if (med >= 12 && med <= 18) {
    score = 100;
  } else if (med > 18) {
    score = Math.max(0, 100 - (med - 18) * 10);
  } else {
    score = Math.max(0, (med / 12) * 100);
  }

  return { score: clamp(score, 0, 100), factors: [`${f} — ${score === 100 ? 'normal' : score > 60 ? 'slightly elevated' : 'elevated'}`] };
}

function computeSO2S(day: DailyHealthData): { score: number; factors: string[] } {
  const readings = day.spo2Readings ?? [];
  const values = readings.map(r => r.percentage).filter(v => v > 0);
  const med = median(values);

  if (med === null) return { score: 100, factors: ['No SpO2 data — neutral'] };

  let score: number;
  if (med >= 95) {
    score = 100;
  } else if (med >= 90) {
    score = Math.round(((med - 90) / 5) * 100);
  } else {
    score = 0;
  }

  return { score: clamp(score, 0, 100), factors: [`SpO2: ${med.toFixed(1)}% — ${score === 100 ? 'normal' : 'below threshold'}`] };
}

function computeWTS(day: DailyHealthData): { score: number; factors: string[] } {
  const deviation = day.wristTemp; // Already a deviation from baseline in °C

  if (deviation === null) return { score: 100, factors: ['No wrist temp data — neutral'] };

  let score: number;
  if (deviation >= -0.5 && deviation <= 0.5) {
    score = 100;
  } else if (deviation > 0.5) {
    score = Math.max(0, 100 - (deviation - 0.5) * 100);
  } else {
    // Cold deviation — less harsh per spec
    score = Math.max(0, 100 - (-0.5 - deviation) * 50);
  }

  return { score: clamp(score, 0, 100), factors: [`Wrist temp: ${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)}°C from baseline`] };
}

export function computeSleepScore(day: DailyHealthData, baselines: Baselines): ComponentScore {
  if (!day.sleep) {
    return { score: 0, factors: ['No sleep data'], dataAvailable: false };
  }

  const ssq = computeSSQ(day, baselines);
  const rrs = computeRRS(day);
  const so2s = computeSO2S(day);
  const wts = computeWTS(day);

  // Recovery Score = (SSQ × 0.50) + (RRS × 0.20) + (SO2S × 0.20) + (WTS × 0.10)
  const score = Math.round(
    ssq.score * 0.50 +
    rrs.score * 0.20 +
    so2s.score * 0.20 +
    wts.score * 0.10
  );

  const factors = [
    `Sleep quality: ${ssq.score}`,
    ...ssq.factors.slice(0, 2),
    ...rrs.factors,
    ...so2s.factors,
    ...wts.factors,
  ];

  return { score: clamp(score, 0, 100), factors, dataAvailable: true };
}

// ─── PILLAR 2: CASS — Current Autonomic State Score (HRV component, 0.35) ─
//
// CASS = (HRVS × 0.60) + (RHRTS × 0.25) + (WHAS × 0.15)
// HRVS uses Z-score vs 30-day baseline (±SD). WHAS = 75 (neutral) until
// walking HR is extracted from Apple Health.

function computeHRVS(day: DailyHealthData, baselines: Baselines): { score: number; factors: string[] } {
  const readings = day.hrvReadings;
  if (readings.length === 0) return { score: 50, factors: ['No HRV data — neutral'] };

  // Get today's mean RMSSD (prefer RMSSD, fallback SDNN)
  const rmssdValues = readings.map(r => r.rmssd).filter((v): v is number => v !== null);
  const sdnnValues = readings.map(r => r.sdnn);
  const todayHrv = rmssdValues.length > 0
    ? rmssdValues.reduce((s, v) => s + v, 0) / rmssdValues.length
    : sdnnValues.reduce((s, v) => s + v, 0) / sdnnValues.length;

  const source = rmssdValues.length > 0 ? 'RMSSD' : 'SDNN';

  // Time-of-day normalization
  const normalizedReadings = readings.map(r => {
    const ratio = getTimeOfDayRatio(r.timestamp.getHours());
    return (r.rmssd ?? r.sdnn) / ratio;
  });
  const normalizedMean = normalizedReadings.reduce((s, v) => s + v, 0) / normalizedReadings.length;

  // Z-score computation (spec formula: HRVS = clamp(0, 100, 50 + Z × 15))
  if (baselines.hrv30d !== null && baselines.hrv30dSD !== null && baselines.hrv30dSD > 0) {
    const z = (normalizedMean - baselines.hrv30d) / baselines.hrv30dSD;
    const score = clamp(Math.round(50 + z * 15), 0, 100);
    const zLabel = z >= 0 ? `+${z.toFixed(2)}σ` : `${z.toFixed(2)}σ`;
    return {
      score,
      factors: [`${source}: ${todayHrv.toFixed(1)}ms · ${zLabel} vs 30d baseline`],
    };
  }

  // Fallback: no 30d SD yet — use % deviation from 7d baseline
  if (baselines.hrv7d !== null) {
    const deviation = (normalizedMean - baselines.hrv7d) / baselines.hrv7d;
    let score = 70;
    if (deviation > 0.15) score = 90;
    else if (deviation > 0.05) score = 80;
    else if (deviation > -0.05) score = 70;
    else if (deviation > -0.15) score = 50;
    else if (deviation > -0.25) score = 35;
    else score = 20;

    // Trend: 7d EMA vs 30d SMA
    if (baselines.hrv30d !== null) {
      const trend = (baselines.hrv7d - baselines.hrv30d) / baselines.hrv30d;
      if (trend > 0.10) score = Math.min(100, score + 5);
      else if (trend < -0.10) score = Math.max(0, score - 5);
    }

    return {
      score: clamp(score, 0, 100),
      factors: [`${source}: ${todayHrv.toFixed(1)}ms · ${(deviation * 100).toFixed(0)}% vs 7d baseline`],
    };
  }

  // No baseline at all — absolute value fallback
  let score = todayHrv > 60 ? 85 : todayHrv > 40 ? 70 : todayHrv > 25 ? 50 : 30;
  return { score, factors: [`${source}: ${todayHrv.toFixed(1)}ms (no baseline yet)`] };
}

function computeRHRTS(day: DailyHealthData, baselines: Baselines): { score: number; factors: string[] } {
  const rhrToday = day.restingHR;
  const rhr7dAvg = baselines.restingHR7d;

  if (rhrToday === null || rhr7dAvg === null) {
    return { score: 75, factors: ['No resting HR data — neutral'] };
  }

  const delta = rhrToday - rhr7dAvg;
  const score = delta <= 0
    ? 100
    : Math.max(0, 100 - delta * 10);

  const label = delta <= 0
    ? `${rhrToday} bpm — at or below 7d avg`
    : `${rhrToday} bpm — +${delta.toFixed(0)} bpm above 7d avg`;

  return { score: clamp(score, 0, 100), factors: [`RHR: ${label}`] };
}

export function computeHrvScore(day: DailyHealthData, baselines: Baselines): ComponentScore {
  if (day.hrvReadings.length === 0 && day.restingHR === null) {
    return { score: 50, factors: ['No HRV or HR data — neutral score'], dataAvailable: false };
  }

  const hrvs = computeHRVS(day, baselines);
  const rhrts = computeRHRTS(day, baselines);
  // WHAS: walking HR — placeholder 75 (neutral) until extracted from Apple Health workouts
  const whas = { score: 75, factors: [] as string[] };

  // CASS = (HRVS × 0.60) + (RHRTS × 0.25) + (WHAS × 0.15)
  const score = Math.round(
    hrvs.score * 0.60 +
    rhrts.score * 0.25 +
    whas.score * 0.15
  );

  const factors = [
    ...hrvs.factors,
    ...rhrts.factors,
  ];

  return { score: clamp(score, 0, 100), factors, dataAvailable: true };
}

// ─── ILAS PART A: CIRCADIAN SCORE (0.075 weight) ─────────────────────────
//
// Wake-time alignment (chronotype-based) + DAS (daylight adequacy).
// CDP (timezone shift) = 100 (no disruption) — placeholder until timezone
// metadata is extracted from Apple Health sleep records.

function computeDAS(day: DailyHealthData): { score: number; factors: string[] } {
  const minutes = day.daylightMinutes;

  if (minutes <= 0) return { score: 50, factors: ['No daylight data — neutral'] };

  let score: number;
  if (minutes >= 120) {
    score = 100;
  } else if (minutes >= 30) {
    score = Math.round(((minutes - 30) / 90) * 100);
  } else {
    score = Math.round((minutes / 30) * 50);
  }

  return {
    score: clamp(score, 0, 100),
    factors: [`Daylight: ${minutes.toFixed(0)} min${minutes >= 120 ? ' (optimal)' : minutes >= 30 ? '' : ' (low)'}`],
  };
}

export function computeCircadianScore(day: DailyHealthData, baselines: Baselines): ComponentScore {
  const factors: string[] = [];

  if (!day.sleep) {
    return { score: 50, factors: ['No sleep data — neutral circadian'], dataAvailable: false };
  }

  // Wake-time alignment (same logic as before)
  const chronotype = baselines.chronotype;
  const idealWake = chronotype === 'early' ? 6 : chronotype === 'normal' ? 7.5 : 9;
  const wakeHour = day.sleep.wakeTime.getHours() + day.sleep.wakeTime.getMinutes() / 60;
  const wakeDrift = Math.abs(wakeHour - idealWake);

  let alignmentScore: number;
  if (wakeDrift < 0.5) {
    alignmentScore = 100;
    factors.push(`Wake ${wakeHour.toFixed(1)}h — aligned (${chronotype})`);
  } else if (wakeDrift < 1) {
    alignmentScore = 90;
    factors.push(`Wake ${wakeHour.toFixed(1)}h — slight drift`);
  } else if (wakeDrift < 2) {
    alignmentScore = 75;
    factors.push(`Wake ${wakeHour.toFixed(1)}h — drifting`);
  } else {
    alignmentScore = 55;
    factors.push(`Wake ${wakeHour.toFixed(1)}h — misaligned (${wakeDrift.toFixed(1)}h off)`);
  }

  // Bedtime consistency penalty
  if (baselines.bedtime7d !== null && day.sleep.bedtime) {
    const bedMin = day.sleep.bedtime.getHours() * 60 + day.sleep.bedtime.getMinutes();
    const adjusted = bedMin > 720 ? bedMin - 1440 : bedMin;
    const deviation = Math.abs(adjusted - baselines.bedtime7d);
    if (deviation > 90) {
      alignmentScore -= 15;
      factors.push(`Irregular bedtime (${deviation.toFixed(0)}min, -15)`);
    }
  }

  // DAS: daylight adequacy
  const das = computeDAS(day);
  factors.push(...das.factors);

  // CDP: timezone shift — placeholder 100 (no disruption detected)
  // TODO: extract sleep record timezone metadata from Apple Health
  const cdp = 100;

  // Circadian component = blend of wake alignment (70%) + DAS (30%)
  // CDP is folded in as a multiplicative dampener when < 100
  const baseScore = Math.round(alignmentScore * 0.70 + das.score * 0.30);
  const cdpFactor = cdp / 100; // 1.0 when no disruption
  const score = Math.round(baseScore * cdpFactor);

  return { score: clamp(score, 0, 100), factors, dataAvailable: true };
}

// ─── ILAS PART B: ACTIVITY/MOTION SCORE (0.075 weight) ───────────────────
//
// EES (Energy Expenditure Score) + Steps/Motion scoring.
// EES compares 48h active energy to 30-day baseline.

function computeEES(day: DailyHealthData, baselines: Baselines): { score: number; factors: string[] } {
  const todayEnergy = day.activeEnergyBurned;
  const baseline7dAvg = baselines.activeEnergy7d;

  if (todayEnergy <= 0 || baseline7dAvg === null || baseline7dAvg <= 0) {
    return { score: 75, factors: [] }; // neutral if no baseline
  }

  // 48h baseline = daily avg × 2 (spec uses 48h window)
  const baseline48h = baseline7dAvg * 2;
  // For today-only: compare today vs daily avg
  const ratio = todayEnergy / baseline7dAvg;

  let score: number;
  if (ratio <= 1.0) {
    score = 100;
  } else {
    // EES penalty: max(0, 100 - (ratio - 1.0) × 100)
    score = Math.max(0, Math.round(100 - (ratio - 1.0) * 100));
  }

  // Suppress the factor message unless notably different
  const factors = Math.abs(ratio - 1.0) > 0.2
    ? [`Active energy: ${todayEnergy.toFixed(0)} kcal vs ${baseline7dAvg.toFixed(0)} avg (×${ratio.toFixed(2)})`]
    : [];

  void baseline48h; // referenced for type clarity only
  return { score: clamp(score, 0, 100), factors };
}

export function computeActivityScore(day: DailyHealthData, baselines: Baselines): ComponentScore {
  const factors: string[] = [];
  let score = 60;

  const steps = day.totalSteps;
  const exerciseMin = day.exerciseMinutes;

  if (steps === 0 && exerciseMin === 0 && !day.activitySummary) {
    return { score: 50, factors: ['No activity data'], dataAvailable: false };
  }

  // Steps scoring
  if (steps >= 10000) {
    score = 90; factors.push(`Steps: ${steps.toLocaleString()} ✓`);
  } else if (steps >= 6000) {
    score = 75; factors.push(`Steps: ${steps.toLocaleString()}`);
  } else if (steps >= 2000) {
    score = 55; factors.push(`Steps: ${steps.toLocaleString()} (low)`);
  } else if (steps > 0) {
    score = 35; factors.push(`Steps: ${steps.toLocaleString()} (very low)`);
  }

  // Exercise: 20–60 min is ideal
  if (exerciseMin >= 20 && exerciseMin <= 60) {
    score = Math.min(100, score + 10);
    factors.push(`Exercise: ${Math.round(exerciseMin)}min (+10)`);
  } else if (exerciseMin > 60) {
    score = Math.max(0, score - 5);
    factors.push(`Heavy exercise: ${Math.round(exerciseMin)}min (-5)`);
  }

  // Stand hours
  if (day.activitySummary) {
    const standHours = day.activitySummary.appleStandHours;
    if (standHours < 6) {
      score = Math.max(0, score - 10);
      factors.push(`Low stand: ${standHours}h (-10)`);
    }
  }

  // EES: energy expenditure vs baseline
  const ees = computeEES(day, baselines);
  if (ees.factors.length > 0) factors.push(...ees.factors);

  // Blend motion score with EES (EES dampens if overexerted)
  const finalScore = Math.round(score * 0.75 + ees.score * 0.25);

  return { score: clamp(finalScore, 0, 100), factors, dataAvailable: true };
}

// ─── PILLAR DRAG ANALYSIS ─────────────────────────────────────────────────
//
// Neutral substitution: what CRS would be if each component were at 75 (neutral).
// Drag = CRS_if_X_neutral − CRS_actual.
// Positive drag = that component is pulling CRS below neutral.

function computePillarDrag(
  crsActual: number,
  sleep: number,
  hrv: number,
  circadian: number,
  activity: number,
): PillarDrag {
  const neutral = 75;
  const w = CRS_WEIGHTS;

  const crsIfSleepNeutral = neutral * w.sleep + hrv * w.hrv + circadian * w.circadian + activity * w.activity;
  const crsIfHrvNeutral = sleep * w.sleep + neutral * w.hrv + circadian * w.circadian + activity * w.activity;
  const crsIfCircNeutral = sleep * w.sleep + hrv * w.hrv + neutral * w.circadian + activity * w.activity;
  const crsIfActNeutral = sleep * w.sleep + hrv * w.hrv + circadian * w.circadian + neutral * w.activity;

  const sleepDrag = Math.round((crsIfSleepNeutral - crsActual) * 10) / 10;
  const hrvDrag = Math.round((crsIfHrvNeutral - crsActual) * 10) / 10;
  const circDrag = Math.round((crsIfCircNeutral - crsActual) * 10) / 10;
  const actDrag = Math.round((crsIfActNeutral - crsActual) * 10) / 10;

  // Primary drag = component with largest positive drag (most responsible for shortfall)
  const drags: Array<[PillarDrag['primary'], number]> = [
    ['sleep', sleepDrag],
    ['hrv', hrvDrag],
    ['circadian', circDrag],
    ['activity', actDrag],
  ];
  const best = drags.reduce<[PillarDrag['primary'], number]>(
    (max, cur) => cur[1] > max[1] ? cur : max,
    ['none', 0],
  );
  const primary: PillarDrag['primary'] = best[1] > 0 ? best[0] : 'none';

  return { sleep: sleepDrag, hrv: hrvDrag, circadian: circDrag, activity: actDrag, primary };
}

// ─── COMPOSITE CRS ────────────────────────────────────────────────────────

export function computeCrs(
  day: DailyHealthData,
  allDays: Map<string, DailyHealthData>,
): CrsResult {
  const baselines = computeBaselines(day.date, allDays);

  const sleep = computeSleepScore(day, baselines);
  const hrv = computeHrvScore(day, baselines);
  const circadian = computeCircadianScore(day, baselines);
  const activity = computeActivityScore(day, baselines);

  const components = [sleep, hrv, circadian, activity];
  const withData = components.filter(c => c.dataAvailable);

  if (withData.length < 3) {
    const emptyDrag: PillarDrag = { sleep: 0, hrv: 0, circadian: 0, activity: 0, primary: 'none' };
    return {
      score: -1, zone: 'low', sleep, hrv, circadian, activity,
      pillars: { recovery: sleep.score, cass: hrv.score, ilas: Math.round((circadian.score + activity.score) / 2) },
      pillarDrag: emptyDrag,
      componentsWithData: withData.length,
      confidence: 0,
      timestamp: day.sleep?.wakeTime ?? new Date(day.date),
      summary: `Insufficient data (${withData.length}/4 components).`,
    };
  }

  // Weighted sum — redistributes weight of missing components
  let totalWeight = 0;
  let weightedSum = 0;
  const weights = [CRS_WEIGHTS.sleep, CRS_WEIGHTS.hrv, CRS_WEIGHTS.circadian, CRS_WEIGHTS.activity];

  for (let i = 0; i < components.length; i++) {
    if (components[i]!.dataAvailable) {
      totalWeight += weights[i]!;
      weightedSum += components[i]!.score * weights[i]!;
    }
  }

  const score = clamp(Math.round(totalWeight > 0 ? weightedSum / totalWeight : 0), 0, 100);
  const zone = getCrsZone(score);

  // 3-pillar rollup for the Brief attribution
  const ilas = Math.round((circadian.score + activity.score) / 2);
  const pillars = { recovery: sleep.score, cass: hrv.score, ilas };

  // Pillar drag analysis
  const pillarDrag = computePillarDrag(score, sleep.score, hrv.score, circadian.score, activity.score);

  const confidence = baselines.daysOfData >= 7 ? 5 : baselines.daysOfData >= 3 ? 8 : 15;
  const summary = buildSummary(score, zone, sleep, hrv, circadian, activity, day, pillarDrag);

  return {
    score, zone, sleep, hrv, circadian, activity,
    pillars, pillarDrag,
    componentsWithData: withData.length,
    confidence,
    timestamp: day.sleep?.wakeTime ?? new Date(day.date),
    summary,
  };
}

function buildSummary(
  score: number,
  zone: string,
  sleep: ComponentScore,
  hrv: ComponentScore,
  _circadian: ComponentScore,
  _activity: ComponentScore,
  day: DailyHealthData,
  drag: PillarDrag,
): string {
  const parts: string[] = [`Form ${score} (${zone})`];

  if (day.sleep) {
    parts.push(`Sleep: ${(day.sleep.totalDurationMinutes / 60).toFixed(1)}h`);
  }
  if (day.hrvReadings.length > 0) {
    const avg = day.hrvReadings.reduce((s, r) => s + (r.rmssd ?? r.sdnn), 0) / day.hrvReadings.length;
    parts.push(`HRV: ${avg.toFixed(0)}ms`);
  }
  if (day.totalSteps > 0) {
    parts.push(`Steps: ${day.totalSteps.toLocaleString()}`);
  }

  // Drag attribution for The Brief
  if (drag.primary !== 'none' && score < 80) {
    const dragMap: Record<string, string> = {
      sleep: 'sleep quality', hrv: 'autonomic recovery',
      circadian: 'circadian alignment', activity: 'physical load',
    };
    const dragging = dragMap[drag.primary];
    if (dragging) parts.push(`Primary drag: ${dragging} (−${Math.abs(drag[drag.primary as keyof typeof drag] as number).toFixed(1)} pts)`);
  }

  // Component scores for context
  const componentLine = `Recovery:${sleep.score} CASS:${hrv.score}`;
  parts.push(componentLine);

  return parts.join(' | ');
}

/**
 * Compute CRS for all days in the dataset.
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
