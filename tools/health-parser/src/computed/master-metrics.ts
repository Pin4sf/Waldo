/**
 * Master Metrics — cross-source derived intelligence.
 * These only exist when multiple adapters are connected.
 *
 * 1. Daily Cognitive Load (DCL) — how overloaded is this person?
 * 2. Burnout Trajectory Score (BTS) — are they heading toward burnout?
 * 3. Resilience Score — how well are they coping over 14 days?
 */
import type { DailyHealthData } from '../types/health.js';
import type { CrsResult } from '../types/crs.js';
import type { DayMeetingData } from '../extractors/calendar-parser.js';
import type { DailyEmailMetrics } from '../extractors/gmail-parser.js';
import type { SleepDebtResult } from './sleep-debt.js';

// ─── Daily Cognitive Load ─────────────────────────────────

export interface CognitiveLoadResult {
  /** 0-100 scale */
  score: number;
  level: 'light' | 'moderate' | 'heavy' | 'overloaded';
  components: {
    meetingLoad: number;
    communicationLoad: number;
    taskLoad: number;
    sleepDebtImpact: number;
  };
  summary: string;
}

function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

export function computeDailyCognitiveLoad(
  meetingData: DayMeetingData | null,
  emailData: DailyEmailMetrics | null,
  taskPileUp: number,
  sleepDebt: SleepDebtResult,
): CognitiveLoadResult {
  // Normalize each component to 0-100
  const meetingLoad = meetingData ? normalize(meetingData.meetingLoadScore, 0, 12) : 0;
  const communicationLoad = emailData ? normalize(emailData.totalEmails, 0, 80) : 0;
  const taskLoad = normalize(taskPileUp, 0, 20);
  const sleepDebtImpact = normalize(sleepDebt.debtHours, 0, 8);

  // Weighted combination
  const score = Math.round(
    meetingLoad * 0.25 +
    communicationLoad * 0.25 +
    taskLoad * 0.20 +
    sleepDebtImpact * 0.30
  );

  const level = score >= 75 ? 'overloaded'
    : score >= 50 ? 'heavy'
    : score >= 25 ? 'moderate'
    : 'light';

  const parts: string[] = [`Cognitive Load: ${score}/100 (${level}).`];
  if (meetingLoad > 50) parts.push(`Meetings are heavy (MLS ${meetingData?.meetingLoadScore ?? 0}).`);
  if (communicationLoad > 50) parts.push(`High email volume.`);
  if (taskLoad > 50) parts.push(`${taskPileUp} tasks overdue.`);
  if (sleepDebtImpact > 50) parts.push(`Sleep debt ${sleepDebt.debtHours}h dragging you down.`);

  return {
    score,
    level,
    components: { meetingLoad: Math.round(meetingLoad), communicationLoad: Math.round(communicationLoad), taskLoad: Math.round(taskLoad), sleepDebtImpact: Math.round(sleepDebtImpact) },
    summary: parts.join(' '),
  };
}

// ─── Burnout Trajectory Score ─────────────────────────────

export interface BurnoutTrajectoryResult {
  /** -1 (recovering) to +1 (burning out) */
  score: number;
  status: 'recovering' | 'stable' | 'warning' | 'burnout_trajectory';
  components: {
    hrvSlope: number;
    sleepDebtTrend: number;
    afterHoursTrend: number;
    mlsTrend: number;
  };
  summary: string;
}

function computeSlope(values: number[]): number {
  if (values.length < 7) return 0;
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  // Normalize to -1..+1 range
  const maxSlope = Math.max(Math.abs(slope), 0.001);
  return Math.max(-1, Math.min(1, slope / maxSlope));
}

export function computeBurnoutTrajectory(
  date: string,
  allDays: Map<string, DailyHealthData>,
  _allCrs: Map<string, CrsResult>,
  calendarData: Map<string, DayMeetingData> | null,
  emailMetrics: Map<string, DailyEmailMetrics> | null,
): BurnoutTrajectoryResult {
  const sortedDates = [...allDays.keys()].sort();
  const idx = sortedDates.indexOf(date);
  if (idx < 14) return emptyBurnout();

  // 30-day lookback
  const lookback = sortedDates.slice(Math.max(0, idx - 30), idx + 1);

  // HRV baseline slope (declining HRV = burnout signal)
  const hrvValues = lookback
    .map(d => {
      const day = allDays.get(d)!;
      if (day.hrvReadings.length === 0) return null;
      return day.hrvReadings.reduce((s, r) => s + (r.rmssd ?? r.sdnn), 0) / day.hrvReadings.length;
    })
    .filter((v): v is number => v !== null);

  const hrvSlope = -computeSlope(hrvValues); // Negative slope = declining = bad = positive burnout signal

  // Sleep debt trend (increasing debt = burnout)
  const sleepValues = lookback
    .map(d => allDays.get(d)!.sleep?.totalDurationMinutes ?? null)
    .filter((v): v is number => v !== null);
  const sleepDebtTrend = -computeSlope(sleepValues); // Less sleep over time = positive burnout

  // After-hours email trend
  let afterHoursTrend = 0;
  if (emailMetrics) {
    const afterHoursValues = lookback
      .map(d => emailMetrics.get(d)?.afterHoursRatio ?? null)
      .filter((v): v is number => v !== null);
    afterHoursTrend = computeSlope(afterHoursValues); // Increasing after-hours = burnout
  }

  // Meeting load trend
  let mlsTrend = 0;
  if (calendarData) {
    const mlsValues = lookback
      .map(d => calendarData.get(d)?.meetingLoadScore ?? null)
      .filter((v): v is number => v !== null);
    mlsTrend = computeSlope(mlsValues); // Increasing meetings = burnout
  }

  // Weighted combination
  const score = Math.round((
    hrvSlope * 0.35 +
    sleepDebtTrend * 0.25 +
    afterHoursTrend * 0.20 +
    mlsTrend * 0.20
  ) * 100) / 100;

  const status = score > 0.6 ? 'burnout_trajectory'
    : score > 0.3 ? 'warning'
    : score < -0.3 ? 'recovering'
    : 'stable';

  const statusLabels: Record<string, string> = {
    recovering: 'Trending toward recovery',
    stable: 'Holding steady',
    warning: 'Early burnout signals',
    burnout_trajectory: 'On a burnout trajectory — needs intervention',
  };

  return {
    score,
    status,
    components: {
      hrvSlope: Math.round(hrvSlope * 100) / 100,
      sleepDebtTrend: Math.round(sleepDebtTrend * 100) / 100,
      afterHoursTrend: Math.round(afterHoursTrend * 100) / 100,
      mlsTrend: Math.round(mlsTrend * 100) / 100,
    },
    summary: `Burnout trajectory: ${score.toFixed(2)} (${statusLabels[status]}). HRV slope: ${hrvSlope > 0 ? 'declining' : 'improving'}. ${afterHoursTrend > 0.3 ? 'After-hours work increasing.' : ''} ${mlsTrend > 0.3 ? 'Meeting load growing.' : ''}`.trim(),
  };
}

function emptyBurnout(): BurnoutTrajectoryResult {
  return { score: 0, status: 'stable', components: { hrvSlope: 0, sleepDebtTrend: 0, afterHoursTrend: 0, mlsTrend: 0 }, summary: 'Not enough data for burnout trajectory (need 14+ days).' };
}

// ─── Resilience Score ─────────────────────────────────────

export interface ResilienceResult {
  /** 0-100 */
  score: number;
  level: 'strong' | 'moderate' | 'fragile' | 'depleted';
  components: {
    crsStability: number;
    hrvTrend: number;
    stressRecovery: number;
  };
  summary: string;
}

export function computeResilience(
  date: string,
  allCrs: Map<string, CrsResult>,
  allDays: Map<string, DailyHealthData>,
): ResilienceResult {
  const sortedDates = [...allCrs.keys()].sort();
  const idx = sortedDates.indexOf(date);
  if (idx < 14) return { score: 50, level: 'moderate', components: { crsStability: 50, hrvTrend: 50, stressRecovery: 50 }, summary: 'Building resilience baseline (need 14+ days).' };

  const lookback14 = sortedDates.slice(Math.max(0, idx - 14), idx + 1);

  // CRS stability: low variance = high resilience
  const crsScores = lookback14.map(d => allCrs.get(d)?.score ?? -1).filter(s => s >= 0);
  const crsAvg = crsScores.length > 0 ? crsScores.reduce((s, v) => s + v, 0) / crsScores.length : 50;
  const crsVariance = crsScores.length > 1
    ? crsScores.reduce((s, v) => s + Math.pow(v - crsAvg, 2), 0) / crsScores.length
    : 0;
  const crsStability = Math.max(0, 100 - Math.sqrt(crsVariance) * 3); // Low variance → high stability

  // HRV trend: improving = resilient
  const hrvValues = lookback14
    .map(d => {
      const day = allDays.get(d)!;
      if (day.hrvReadings.length === 0) return null;
      return day.hrvReadings.reduce((s, r) => s + (r.rmssd ?? r.sdnn), 0) / day.hrvReadings.length;
    })
    .filter((v): v is number => v !== null);

  let hrvTrend = 50;
  if (hrvValues.length >= 7) {
    const first = hrvValues.slice(0, Math.floor(hrvValues.length / 2));
    const second = hrvValues.slice(Math.floor(hrvValues.length / 2));
    const firstAvg = first.reduce((s, v) => s + v, 0) / first.length;
    const secondAvg = second.reduce((s, v) => s + v, 0) / second.length;
    const change = (secondAvg - firstAvg) / firstAvg;
    hrvTrend = Math.max(0, Math.min(100, 50 + change * 200)); // +10% → 70, -10% → 30
  }

  // Stress recovery: how quickly CRS bounces back after low days
  let stressRecovery = 50;
  const lowDays = lookback14.filter(d => (allCrs.get(d)?.score ?? 100) < 50);
  if (lowDays.length > 0) {
    let recoveries = 0;
    for (const lowDay of lowDays) {
      const ldIdx = sortedDates.indexOf(lowDay);
      const nextDay = sortedDates[ldIdx + 1];
      if (nextDay && (allCrs.get(nextDay)?.score ?? 0) > (allCrs.get(lowDay)?.score ?? 0) + 10) {
        recoveries++;
      }
    }
    stressRecovery = lowDays.length > 0 ? (recoveries / lowDays.length) * 100 : 50;
  }

  const score = Math.round(crsStability * 0.40 + hrvTrend * 0.35 + stressRecovery * 0.25);
  const level = score >= 75 ? 'strong' : score >= 50 ? 'moderate' : score >= 25 ? 'fragile' : 'depleted';

  return {
    score,
    level,
    components: { crsStability: Math.round(crsStability), hrvTrend: Math.round(hrvTrend), stressRecovery: Math.round(stressRecovery) },
    summary: `Resilience: ${score}/100 (${level}). CRS stability: ${Math.round(crsStability)}. HRV trend: ${hrvTrend > 60 ? 'improving' : hrvTrend < 40 ? 'declining' : 'stable'}. ${lowDays.length > 0 ? `Recovery from ${lowDays.length} low days: ${Math.round(stressRecovery)}%.` : 'No recent low days.'}`,
  };
}

// ─── Cross-source patterns ────────────────────────────────

export interface CrossSourceInsight {
  type: 'meeting_stress' | 'email_sleep' | 'task_energy' | 'afterhours_sleep' | 'load_crs';
  summary: string;
  confidence: 'high' | 'moderate' | 'low';
  evidenceCount: number;
}

export function detectCrossSourcePatterns(
  allDays: Map<string, DailyHealthData>,
  allCrs: Map<string, CrsResult>,
  calendarData: Map<string, DayMeetingData> | null,
  emailMetrics: Map<string, DailyEmailMetrics> | null,
): CrossSourceInsight[] {
  const insights: CrossSourceInsight[] = [];
  const sortedDates = [...allDays.keys()].sort();

  // 1. Meeting-heavy days vs CRS
  if (calendarData && calendarData.size >= 10) {
    const heavyMeetingDays: number[] = [];
    const lightMeetingDays: number[] = [];

    for (const date of sortedDates) {
      const cal = calendarData.get(date);
      const crs = allCrs.get(date);
      if (!cal || !crs || crs.score < 0) continue;

      if (cal.meetingLoadScore >= 5) heavyMeetingDays.push(crs.score);
      else if (cal.meetingLoadScore <= 2) lightMeetingDays.push(crs.score);
    }

    if (heavyMeetingDays.length >= 3 && lightMeetingDays.length >= 3) {
      const heavyAvg = heavyMeetingDays.reduce((s, v) => s + v, 0) / heavyMeetingDays.length;
      const lightAvg = lightMeetingDays.reduce((s, v) => s + v, 0) / lightMeetingDays.length;
      const delta = lightAvg - heavyAvg;

      if (delta > 5) {
        insights.push({
          type: 'meeting_stress',
          summary: `Meeting-heavy days (MLS 5+) average CRS ${Math.round(heavyAvg)}, vs ${Math.round(lightAvg)} on light days. That's a ${Math.round(delta)}-point impact.`,
          confidence: delta > 10 ? 'high' : 'moderate',
          evidenceCount: heavyMeetingDays.length + lightMeetingDays.length,
        });
      }
    }
  }

  // 2. After-hours email → next day sleep
  if (emailMetrics) {
    const afterHoursHigh: number[] = [];
    const afterHoursLow: number[] = [];

    for (let i = 0; i < sortedDates.length - 1; i++) {
      const today = sortedDates[i]!;
      const tomorrow = sortedDates[i + 1]!;
      const email = emailMetrics.get(today);
      const nextSleep = allDays.get(tomorrow)?.sleep;

      if (!email || !nextSleep) continue;

      const sleepHours = nextSleep.totalDurationMinutes / 60;
      if (email.afterHoursRatio > 0.3) afterHoursHigh.push(sleepHours);
      else afterHoursLow.push(sleepHours);
    }

    if (afterHoursHigh.length >= 5 && afterHoursLow.length >= 5) {
      const highAvg = afterHoursHigh.reduce((s, v) => s + v, 0) / afterHoursHigh.length;
      const lowAvg = afterHoursLow.reduce((s, v) => s + v, 0) / afterHoursLow.length;
      const delta = lowAvg - highAvg;

      if (delta > 0.3) {
        insights.push({
          type: 'afterhours_sleep',
          summary: `Nights with heavy after-hours email (>30%), next-day sleep averages ${highAvg.toFixed(1)}h vs ${lowAvg.toFixed(1)}h. That's ${(delta * 60).toFixed(0)} minutes less.`,
          confidence: delta > 0.5 ? 'high' : 'moderate',
          evidenceCount: afterHoursHigh.length + afterHoursLow.length,
        });
      }
    }
  }

  // 3. Email volume days vs CRS
  if (emailMetrics) {
    const highVolumeDays: number[] = [];
    const normalDays: number[] = [];

    for (const date of sortedDates) {
      const email = emailMetrics.get(date);
      const crs = allCrs.get(date);
      if (!email || !crs || crs.score < 0) continue;

      if (email.volumeSpike > 1.5) highVolumeDays.push(crs.score);
      else normalDays.push(crs.score);
    }

    if (highVolumeDays.length >= 3 && normalDays.length >= 3) {
      const highAvg = highVolumeDays.reduce((s, v) => s + v, 0) / highVolumeDays.length;
      const normalAvg = normalDays.reduce((s, v) => s + v, 0) / normalDays.length;
      const delta = normalAvg - highAvg;

      if (delta > 5) {
        insights.push({
          type: 'load_crs',
          summary: `High-email days (1.5x+ normal volume) average CRS ${Math.round(highAvg)}, vs ${Math.round(normalAvg)} on normal days. Email overload costs ${Math.round(delta)} CRS points.`,
          confidence: delta > 8 ? 'high' : 'moderate',
          evidenceCount: highVolumeDays.length + normalDays.length,
        });
      }
    }
  }

  return insights;
}
