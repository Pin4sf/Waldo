/**
 * CRS / Form computation engine — spec-accurate implementation.
 *
 * Three-pillar formula (the engine):
 *   CRS = (Recovery Score × 0.50) + (CASS × 0.35) + (ILAS × 0.15)
 *
 * Four-component display (what FormCard shows):
 *   Form = Sleep score (35%) + HRV score (25%) + Circadian score (25%) + Motion score (15%)
 *
 * The pillars are the math. The components are the user-facing explanation.
 * Recovery ≈ Sleep score. CASS ≈ HRV score. ILAS ≈ Circadian + Motion.
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
// Plus architecture-layer penalties applied on top: bedtime drift + sleep debt.

/**
 * SSQ — Sleep Stage Quality (spec formula, proportional scoring only).
 * NO duration, bedtime, or debt inside SSQ. Those belong at the Recovery Score level.
 */
function computeSSQ(sleep: { deepPercent: number; remPercent: number; efficiency: number }): number {
  // Deep Sleep Score: target 13–23% of TST
  const deepPct = sleep.deepPercent * 100;
  const deepScore = deepPct >= 13 ? 100 : Math.round((deepPct / 13) * 100);

  // REM Score: target 20–25% of TST
  const remPct = sleep.remPercent * 100;
  const remScore = remPct >= 20 ? 100 : Math.round((remPct / 20) * 100);

  // Sleep Efficiency Score: target ≥ 85%
  const effPct = sleep.efficiency * 100;
  const seScore = effPct >= 85 ? 100 : Math.round((effPct / 85) * 100);

  // SSQ = (Deep × 0.40) + (REM × 0.35) + (SE × 0.25)
  return Math.round(deepScore * 0.40 + remScore * 0.35 + seScore * 0.25);
}

function computeRRS(day: DailyHealthData): { score: number; factors: string[] } {
  const values = (day.respiratoryReadings ?? []).map(r => r.breathsPerMinute).filter(v => v > 0);
  const med = median(values);
  if (med === null) return { score: 100, factors: ['No respiratory rate data — neutral'] };

  let score: number;
  if (med >= 12 && med <= 18) score = 100;
  else if (med > 18) score = Math.max(0, 100 - (med - 18) * 10);
  else score = Math.max(0, (med / 12) * 100);

  return {
    score: clamp(score, 0, 100),
    factors: [`Resp: ${med.toFixed(1)} brpm — ${score === 100 ? 'normal' : 'elevated'}`],
  };
}

function computeSO2S(day: DailyHealthData): { score: number; factors: string[] } {
  const values = (day.spo2Readings ?? []).map(r => r.percentage).filter(v => v > 0);
  const med = median(values);
  if (med === null) return { score: 100, factors: ['No SpO2 data — neutral'] };

  let score: number;
  if (med >= 95) score = 100;
  else if (med >= 90) score = Math.round(((med - 90) / 5) * 100);
  else score = 0;

  return {
    score: clamp(score, 0, 100),
    factors: [`SpO2: ${med.toFixed(1)}%${score < 100 ? ' — below threshold' : ''}`],
  };
}

function computeWTS(day: DailyHealthData): { score: number; factors: string[] } {
  const dev = day.wristTemp;
  if (dev === null) return { score: 100, factors: ['No wrist temp data — neutral'] };

  let score: number;
  if (dev >= -0.5 && dev <= 0.5) score = 100;
  else if (dev > 0.5) score = Math.max(0, 100 - (dev - 0.5) * 100);
  else score = Math.max(0, 100 - (-0.5 - dev) * 50);

  return {
    score: clamp(score, 0, 100),
    factors: [`Wrist temp: ${dev >= 0 ? '+' : ''}${dev.toFixed(2)}°C`],
  };
}

export function computeSleepScore(day: DailyHealthData, baselines: Baselines): ComponentScore {
  if (!day.sleep) {
    return { score: 0, factors: ['No sleep data'], dataAvailable: false };
  }

  const sleep = day.sleep;
  const factors: string[] = [];

  // ── Pure SSQ (stage quality only) ─────────────────────────────
  const ssq = computeSSQ({
    deepPercent: sleep.deepPercent,
    remPercent: sleep.remPercent,
    efficiency: sleep.efficiency,
  });

  const rrs = computeRRS(day);
  const so2s = computeSO2S(day);
  const wts = computeWTS(day);

  // Recovery Score = (SSQ × 0.50) + (RRS × 0.20) + (SO2S × 0.20) + (WTS × 0.10)
  let recoveryScore = Math.round(ssq * 0.50 + rrs.score * 0.20 + so2s.score * 0.20 + wts.score * 0.10);

  factors.push(`Sleep quality: ${ssq}`);
  factors.push(...rrs.factors);
  factors.push(...so2s.factors);
  factors.push(...wts.factors);

  // ── Architecture-layer penalties applied ON TOP of Recovery Score ──
  // These are specified separately in the architecture doc, not inside SSQ.
  const durationHours = sleep.totalDurationMinutes / 60;

  // Duration penalties (architecture addendum)
  if (durationHours < 6) {
    const penalty = Math.min(30, Math.round((6 - durationHours) * 12));
    recoveryScore -= penalty;
    factors.push(`Short sleep: ${durationHours.toFixed(1)}h (-${penalty})`);
  } else if (durationHours < 7) {
    const penalty = Math.round((7 - durationHours) * 8);
    recoveryScore -= penalty;
    factors.push(`Below target: ${durationHours.toFixed(1)}h (-${penalty})`);
  }

  // Bedtime drift penalty
  if (baselines.bedtime7d !== null && sleep.bedtime) {
    const bedMin = sleep.bedtime.getHours() * 60 + sleep.bedtime.getMinutes();
    const adj = bedMin > 720 ? bedMin - 1440 : bedMin;
    const drift = Math.abs(adj - baselines.bedtime7d);
    if (drift > 120) {
      recoveryScore -= 20;
      factors.push(`Bedtime drift: ${drift.toFixed(0)}min (-20)`);
    } else if (drift > 60) {
      recoveryScore -= 10;
      factors.push(`Bedtime drift: ${drift.toFixed(0)}min (-10)`);
    }
  }

  // Sleep debt penalty (max -30 on Recovery Score)
  if (baselines.sleepDuration7d !== null) {
    const targetMin = 7.5 * 60;
    if (baselines.sleepDuration7d < targetMin) {
      const debtHours = (targetMin - baselines.sleepDuration7d) / 60;
      const penalty = Math.min(30, Math.round(debtHours * 5));
      recoveryScore -= penalty;
      factors.push(`Sleep debt: ${debtHours.toFixed(1)}h (-${penalty})`);
    }
  }

  return { score: clamp(recoveryScore, 0, 100), factors, dataAvailable: true };
}

// ─── PILLAR 2: CASS (HRV component, 0.35 weight) ──────────────────────────
//
// CASS = (HRVS × 0.60) + (RHRTS × 0.25) + (WHAS × 0.15)

function computeWHAS(day: DailyHealthData, baselines: Baselines): { score: number; factors: string[] } {
  // Walking HR average — spec: delta vs 30d baseline, ×5 penalty per bpm above
  const todayWalkingHR = day.walkingHR;

  // Use resting HR 30d as a proxy baseline if dedicated walking HR baseline isn't available
  // (a rough approximation until we have 30d walking HR in baselines)
  const baseline = baselines.restingHR7d ? baselines.restingHR7d + 20 : null; // walking HR typically ~20bpm above resting

  if (todayWalkingHR === null) return { score: 75, factors: [] }; // neutral placeholder
  if (baseline === null) return { score: 75, factors: [] };

  const delta = todayWalkingHR - baseline;
  const score = delta <= 0 ? 100 : Math.max(0, 100 - delta * 5);
  return {
    score: clamp(score, 0, 100),
    factors: delta > 5 ? [`Walking HR: ${Math.round(todayWalkingHR)} bpm (+${delta.toFixed(0)} above norm)`] : [],
  };
}

function computeHRVS(day: DailyHealthData, baselines: Baselines): { score: number; factors: string[] } {
  if (day.hrvReadings.length === 0) return { score: 50, factors: ['No HRV data — neutral'] };

  const rmssdValues = day.hrvReadings.map(r => r.rmssd).filter((v): v is number => v !== null);
  const sdnnValues = day.hrvReadings.map(r => r.sdnn);
  const todayHrv = rmssdValues.length > 0
    ? rmssdValues.reduce((s, v) => s + v, 0) / rmssdValues.length
    : sdnnValues.reduce((s, v) => s + v, 0) / sdnnValues.length;
  const source = rmssdValues.length > 0 ? 'RMSSD' : 'SDNN';

  // Time-of-day normalization
  const normalizedMean = day.hrvReadings.reduce((sum, r) => {
    const ratio = getTimeOfDayRatio(r.timestamp.getHours());
    return sum + (r.rmssd ?? r.sdnn) / ratio;
  }, 0) / day.hrvReadings.length;

  // Z-score formula (spec): HRVS = clamp(0, 100, 50 + Z×15)
  if (baselines.hrv30d !== null && baselines.hrv30dSD !== null && baselines.hrv30dSD > 0) {
    const z = (normalizedMean - baselines.hrv30d) / baselines.hrv30dSD;
    const score = clamp(Math.round(50 + z * 15), 0, 100);
    return {
      score,
      factors: [`${source}: ${todayHrv.toFixed(1)}ms · ${z >= 0 ? '+' : ''}${z.toFixed(2)}σ vs 30d`],
    };
  }

  // Fallback: % deviation from 7d EMA (no 30d SD yet)
  if (baselines.hrv7d !== null) {
    const dev = (normalizedMean - baselines.hrv7d) / baselines.hrv7d;
    let score = dev > 0.15 ? 90 : dev > 0.05 ? 80 : dev > -0.05 ? 70 : dev > -0.15 ? 50 : dev > -0.25 ? 35 : 20;
    if (baselines.hrv30d !== null) {
      const trend = (baselines.hrv7d - baselines.hrv30d) / baselines.hrv30d;
      if (trend > 0.10) score = Math.min(100, score + 5);
      else if (trend < -0.10) score = Math.max(0, score - 5);
    }
    return {
      score: clamp(score, 0, 100),
      factors: [`${source}: ${todayHrv.toFixed(1)}ms · ${(dev * 100).toFixed(0)}% vs 7d baseline`],
    };
  }

  // No baseline — absolute value fallback
  const score = todayHrv > 60 ? 85 : todayHrv > 40 ? 70 : todayHrv > 25 ? 50 : 30;
  return { score, factors: [`${source}: ${todayHrv.toFixed(1)}ms (no baseline yet)`] };
}

function computeRHRTS(day: DailyHealthData, baselines: Baselines): { score: number; factors: string[] } {
  const today = day.restingHR;
  const avg7d = baselines.restingHR7d;
  if (today === null || avg7d === null) return { score: 75, factors: ['No resting HR — neutral'] };

  const delta = today - avg7d;
  const score = delta <= 0 ? 100 : Math.max(0, 100 - delta * 10);
  return {
    score: clamp(score, 0, 100),
    factors: delta > 0 ? [`RHR: ${today} bpm (+${delta.toFixed(0)} above avg)`] : [`RHR: ${today} bpm`],
  };
}

export function computeHrvScore(day: DailyHealthData, baselines: Baselines): ComponentScore {
  if (day.hrvReadings.length === 0 && day.restingHR === null) {
    return { score: 50, factors: ['No HRV or HR data — neutral'], dataAvailable: false };
  }

  const hrvs = computeHRVS(day, baselines);
  const rhrts = computeRHRTS(day, baselines);
  const whas = computeWHAS(day, baselines);

  // CASS = (HRVS × 0.60) + (RHRTS × 0.25) + (WHAS × 0.15)
  const score = Math.round(hrvs.score * 0.60 + rhrts.score * 0.25 + whas.score * 0.15);
  return {
    score: clamp(score, 0, 100),
    factors: [...hrvs.factors, ...rhrts.factors],
    dataAvailable: true,
  };
}

// ─── PILLAR 3: ILAS (unified engine, 0.15 weight) ─────────────────────────
//
// ILAS = (EES × 0.30) + (PES × 0.25) + (CDP × 0.30) + (DAS × 0.15)
// Higher load = lower ILAS. "Inverse" because accumulation works against readiness.

function computeEES(day: DailyHealthData, yesterday: DailyHealthData | null, baselines: Baselines): number {
  const baseline30dAvg = baselines.activeEnergy30d;
  if (baseline30dAvg === null || baseline30dAvg <= 0) return 75; // neutral

  // 48h window (spec): today + yesterday vs (30d_daily_avg × 2)
  const energy48h = day.activeEnergyBurned + (yesterday?.activeEnergyBurned ?? 0);
  const baseline48h = baseline30dAvg * 2;
  const ratio = energy48h / baseline48h;

  if (ratio <= 1.0) return 100;
  return Math.max(0, Math.round(100 - (ratio - 1.0) * 100));
}

function computePES(day: DailyHealthData, baselines: Baselines): number {
  // Physical Effort Score: MET_ratio = today_avg / 30d_baseline
  // ≤1.0 → 100; >1.0 → max(0, 100-(ratio-1)×80)
  const todayMET = day.physicalEffortAvg;

  // Fallback: derive from active energy if physical effort not available
  const baseline30d = baselines.activeEnergy30d;
  const todayEnergy = day.activeEnergyBurned;

  if (todayMET !== null && todayMET > 0) {
    // TODO: need 30d MET baseline in baselines — use today-only fallback for now
    // Once baselines has physicalEffort30d, replace with real ratio
    return 75; // neutral until 30d MET baseline is tracked
  }

  if (todayEnergy <= 0 || baseline30d === null || baseline30d <= 0) return 75;
  const ratio = todayEnergy / baseline30d;
  if (ratio <= 1.0) return 100;
  return Math.max(0, Math.round(100 - (ratio - 1.0) * 80));
}

function computeCDP(
  day: DailyHealthData,
  yesterday: DailyHealthData | null,
): number {
  // Circadian Disruption Penalty: timezone shift between consecutive sleep sessions.
  // ×12 penalty per hour of shift. 0h shift = 100 (no disruption).
  const todayTZ = day.sleepTimezoneOffsetHours;
  const yestTZ = yesterday?.sleepTimezoneOffsetHours ?? null;

  if (todayTZ === null || yestTZ === null) return 100; // no disruption detectable

  const deltaHours = Math.abs(todayTZ - yestTZ);
  if (deltaHours === 0) return 100;
  return Math.max(0, Math.round(100 - deltaHours * 12));
}

function computeDAS(day: DailyHealthData): number {
  const min = day.daylightMinutes;
  if (min <= 0) return 50; // neutral
  if (min >= 120) return 100;
  if (min >= 30) return Math.round(((min - 30) / 90) * 100);
  return Math.round((min / 30) * 50);
}

/**
 * Compute unified ILAS score per spec.
 * Returns { ilas, subScores } where subScores expose each sub-component for drag analysis.
 */
function computeILAS(
  day: DailyHealthData,
  yesterday: DailyHealthData | null,
  baselines: Baselines,
): { score: number; ees: number; pes: number; cdp: number; das: number; factors: string[] } {
  const ees = computeEES(day, yesterday, baselines);
  const pes = computePES(day, baselines);
  const cdp = computeCDP(day, yesterday);
  const das = computeDAS(day);

  // ILAS = (EES × 0.30) + (PES × 0.25) + (CDP × 0.30) + (DAS × 0.15)
  const score = Math.round(ees * 0.30 + pes * 0.25 + cdp * 0.30 + das * 0.15);

  const factors: string[] = [];
  if (ees < 80) factors.push(`Energy load: ${ees} (48h elevated)`);
  if (cdp < 100) factors.push(`Timezone shift: ${cdp} (circadian disruption detected)`);
  if (das < 60) factors.push(`Daylight: ${day.daylightMinutes.toFixed(0)}min (${das})`);

  return { score: clamp(score, 0, 100), ees, pes, cdp, das, factors };
}

// ─── DISPLAY COMPONENTS (FormCard, 4-bar breakdown) ───────────────────────
//
// These are the user-facing explanations. The actual CRS math uses 3 pillars above.
// Circadian and Motion are computed separately from ILAS for the display.

export function computeCircadianScore(day: DailyHealthData, baselines: Baselines): ComponentScore {
  if (!day.sleep) return { score: 50, factors: ['No sleep data — neutral circadian'], dataAvailable: false };

  const factors: string[] = [];

  // Wake-time alignment (chronotype-based)
  const idealWake = baselines.chronotype === 'early' ? 6 : baselines.chronotype === 'normal' ? 7.5 : 9;
  const wakeHour = day.sleep.wakeTime.getHours() + day.sleep.wakeTime.getMinutes() / 60;
  const drift = Math.abs(wakeHour - idealWake);

  let score: number;
  if (drift < 0.5) { score = 100; factors.push(`Wake ${wakeHour.toFixed(1)}h — aligned`); }
  else if (drift < 1) { score = 90; factors.push(`Wake ${wakeHour.toFixed(1)}h — slight drift`); }
  else if (drift < 2) { score = 75; factors.push(`Wake ${wakeHour.toFixed(1)}h — drifting`); }
  else { score = 55; factors.push(`Wake ${wakeHour.toFixed(1)}h — misaligned (${drift.toFixed(1)}h off)`); }

  // Bedtime consistency
  if (baselines.bedtime7d !== null && day.sleep.bedtime) {
    const bedMin = day.sleep.bedtime.getHours() * 60 + day.sleep.bedtime.getMinutes();
    const adj = bedMin > 720 ? bedMin - 1440 : bedMin;
    const devMin = Math.abs(adj - baselines.bedtime7d);
    if (devMin > 90) { score -= 15; factors.push(`Irregular bedtime (-15)`); }
  }

  // DAS contribution to circadian display
  const das = computeDAS(day);
  const dasLabel = day.daylightMinutes >= 120 ? '— optimal' : day.daylightMinutes >= 30 ? '' : '— low';
  if (day.daylightMinutes > 0) factors.push(`Daylight: ${day.daylightMinutes.toFixed(0)}min ${dasLabel}`);

  // Circadian display = wake alignment (70%) + daylight adequacy (30%)
  const displayScore = Math.round(score * 0.70 + das * 0.30);

  return { score: clamp(displayScore, 0, 100), factors, dataAvailable: true };
}

export function computeActivityScore(
  day: DailyHealthData,
  yesterday: DailyHealthData | null,
  baselines: Baselines,
): ComponentScore {
  if (day.totalSteps === 0 && day.exerciseMinutes === 0 && !day.activitySummary) {
    return { score: 50, factors: ['No activity data'], dataAvailable: false };
  }

  const factors: string[] = [];
  let motionScore = 60;

  // Steps scoring
  const steps = day.totalSteps;
  if (steps >= 10000) { motionScore = 90; factors.push(`Steps: ${steps.toLocaleString()} ✓`); }
  else if (steps >= 6000) { motionScore = 75; factors.push(`Steps: ${steps.toLocaleString()}`); }
  else if (steps >= 2000) { motionScore = 55; factors.push(`Steps: ${steps.toLocaleString()} (low)`); }
  else if (steps > 0) { motionScore = 35; factors.push(`Steps: ${steps.toLocaleString()} (very low)`); }

  // Exercise
  if (day.exerciseMinutes >= 20 && day.exerciseMinutes <= 60) {
    motionScore = Math.min(100, motionScore + 10);
    factors.push(`Exercise: ${Math.round(day.exerciseMinutes)}min (+10)`);
  } else if (day.exerciseMinutes > 60) {
    motionScore = Math.max(0, motionScore - 5);
    factors.push(`Heavy exercise: ${Math.round(day.exerciseMinutes)}min (-5)`);
  }

  // Stand hours
  if (day.activitySummary && day.activitySummary.appleStandHours < 6) {
    motionScore = Math.max(0, motionScore - 10);
    factors.push(`Low stand: ${day.activitySummary.appleStandHours}h (-10)`);
  }

  // EES contribution — energy load dampens activity display
  const ees = computeEES(day, yesterday, baselines);

  // Activity display = motion signals (75%) + energy efficiency (25%)
  const displayScore = Math.round(motionScore * 0.75 + ees * 0.25);

  return { score: clamp(displayScore, 0, 100), factors, dataAvailable: true };
}

// ─── PILLAR DRAG ANALYSIS ─────────────────────────────────────────────────
//
// Neutral substitution at 75. Drag = CRS_if_X_neutral − CRS_actual.
// Positive drag = that pillar is suppressing CRS.

function computePillarDrag(
  crsActual: number,
  recovery: number,
  cass: number,
  ilas: number,
): PillarDrag & { ilasRaw: number } {
  const N = 75;
  const crsIfRecoveryNeutral = N * 0.50 + cass * 0.35 + ilas * 0.15;
  const crsIfCassNeutral = recovery * 0.50 + N * 0.35 + ilas * 0.15;
  const crsIfIlasNeutral = recovery * 0.50 + cass * 0.35 + N * 0.15;

  const sleepDrag = Math.round((crsIfRecoveryNeutral - crsActual) * 10) / 10;
  const hrvDrag = Math.round((crsIfCassNeutral - crsActual) * 10) / 10;
  const ilasDrag = Math.round((crsIfIlasNeutral - crsActual) * 10) / 10;

  // Map ILAS drag to the circadian display component (CDP is the bigger sub-component)
  // and a smaller contribution to the activity display component
  const circDrag = Math.round(ilasDrag * 0.60 * 10) / 10; // CDP+DAS = 45% of ILAS weighted towards circadian
  const actDrag = Math.round(ilasDrag * 0.40 * 10) / 10;  // EES+PES = 55% of ILAS weighted towards activity

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

  return { sleep: sleepDrag, hrv: hrvDrag, circadian: circDrag, activity: actDrag, primary, ilasRaw: ilasDrag };
}

// ─── COMPOSITE CRS ────────────────────────────────────────────────────────

export function computeCrs(
  day: DailyHealthData,
  allDays: Map<string, DailyHealthData>,
): CrsResult {
  const baselines = computeBaselines(day.date, allDays);

  // Get yesterday for EES 48h window
  const sortedDates = [...allDays.keys()].sort();
  const dayIndex = sortedDates.indexOf(day.date);
  const yesterday = dayIndex > 0 ? (allDays.get(sortedDates[dayIndex - 1]!) ?? null) : null;

  // ── Three pillars (the CRS engine) ─────────────────────────────
  const sleepComp = computeSleepScore(day, baselines);           // Recovery Score
  const hrvComp = computeHrvScore(day, baselines);               // CASS
  const ilasResult = computeILAS(day, yesterday, baselines);     // ILAS (unified)

  // ── Four display components (FormCard) ──────────────────────────
  const circComp = computeCircadianScore(day, baselines);        // display only
  const actComp = computeActivityScore(day, yesterday, baselines); // display only

  const displayComponents = [sleepComp, hrvComp, circComp, actComp];
  const withData = displayComponents.filter(c => c.dataAvailable);

  if (withData.length < 3) {
    const emptyDrag: PillarDrag = { sleep: 0, hrv: 0, circadian: 0, activity: 0, primary: 'none' };
    return {
      score: -1, zone: 'low', sleep: sleepComp, hrv: hrvComp, circadian: circComp, activity: actComp,
      pillars: { recovery: sleepComp.score, cass: hrvComp.score, ilas: ilasResult.score },
      pillarDrag: emptyDrag, componentsWithData: withData.length, confidence: 0,
      timestamp: day.sleep?.wakeTime ?? new Date(day.date),
      summary: `Insufficient data (${withData.length}/4 components).`,
    };
  }

  // CRS = (Recovery × 0.50) + (CASS × 0.35) + (ILAS × 0.15)
  const score = clamp(
    Math.round(sleepComp.score * CRS_WEIGHTS.sleep + hrvComp.score * CRS_WEIGHTS.hrv + ilasResult.score * (CRS_WEIGHTS.circadian + CRS_WEIGHTS.activity)),
    0, 100,
  );
  const zone = getCrsZone(score);

  const pillars = {
    recovery: sleepComp.score,
    cass: hrvComp.score,
    ilas: ilasResult.score,
  };

  const drag = computePillarDrag(score, sleepComp.score, hrvComp.score, ilasResult.score);
  const pillarDrag: PillarDrag = { sleep: drag.sleep, hrv: drag.hrv, circadian: drag.circadian, activity: drag.activity, primary: drag.primary };

  const confidence = baselines.daysOfData >= 7 ? 5 : baselines.daysOfData >= 3 ? 8 : 15;
  const summary = buildSummary(score, zone, sleepComp, hrvComp, pillars, drag, day);

  return {
    score, zone,
    sleep: sleepComp, hrv: hrvComp, circadian: circComp, activity: actComp,
    pillars, pillarDrag,
    componentsWithData: withData.length, confidence,
    timestamp: day.sleep?.wakeTime ?? new Date(day.date),
    summary,
  };
}

function buildSummary(
  score: number,
  zone: string,
  _sleep: ComponentScore,
  _hrv: ComponentScore,
  pillars: { recovery: number; cass: number; ilas: number },
  drag: PillarDrag & { ilasRaw: number },
  day: DailyHealthData,
): string {
  const parts: string[] = [`Form ${score} (${zone})`];

  if (day.sleep) parts.push(`Sleep: ${(day.sleep.totalDurationMinutes / 60).toFixed(1)}h`);
  if (day.hrvReadings.length > 0) {
    const avg = day.hrvReadings.reduce((s, r) => s + (r.rmssd ?? r.sdnn), 0) / day.hrvReadings.length;
    parts.push(`HRV: ${avg.toFixed(0)}ms`);
  }
  if (day.totalSteps > 0) parts.push(`Steps: ${day.totalSteps.toLocaleString()}`);

  // Causal chain for The Brief
  if (drag.primary !== 'none' && score < 80) {
    const labels: Record<string, string> = {
      sleep: 'sleep recovery', hrv: 'autonomic state', circadian: 'circadian alignment', activity: 'physical load',
    };
    const label = labels[drag.primary];
    const dragVal = drag[drag.primary as keyof typeof drag];
    if (label && typeof dragVal === 'number') {
      parts.push(`Primary drag: ${label} (−${Math.abs(dragVal).toFixed(1)}pts)`);
    }
  }

  parts.push(`Recovery:${pillars.recovery} CASS:${pillars.cass} ILAS:${pillars.ilas}`);
  return parts.join(' | ');
}

// ─── BATCH COMPUTATION ────────────────────────────────────────────────────

export function computeAllCrs(days: Map<string, DailyHealthData>): Map<string, CrsResult> {
  const results = new Map<string, CrsResult>();
  for (const date of [...days.keys()].sort()) {
    results.set(date, computeCrs(days.get(date)!, days));
  }
  return results;
}
