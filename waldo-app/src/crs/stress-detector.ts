/**
 * Stress detection engine — "The Sniff"
 * PORTED FROM tools/health-parser/src/computed/stress-detector.ts — DO NOT MODIFY ALGORITHM.
 *
 * Confidence = 0.35×(HRV drop) + 0.25×(HR elevation) + 0.20×(duration) + 0.20×(1-activity)
 *
 * Uses sliding windows over HR/HRV data to detect sustained stress events.
 * Activity context filters exercise from stress. 2h cooldown between alerts.
 */
import type { DailyHealthData, HRRecord } from '@/types/health';
import type { Baselines } from './types';
import type { StressEvent, DailyStressSummary } from './stress-types';
import { STRESS_WEIGHTS, getStressSeverity } from './stress-types';
import { getTimeOfDayRatio } from './types';
import { computeBaselines } from './baseline-calculator';

const MIN_DURATION_MINUTES = 10;
const ALERT_COOLDOWN_MINUTES = 120;
const MAX_ALERTS_PER_DAY = 3;
const HR_WINDOW_MINUTES = 15;

interface HRWindow {
  startTime: Date;
  endTime: Date;
  readings: HRRecord[];
  meanBpm: number;
  maxBpm: number;
}

function isDuringWorkout(timestamp: Date, workouts: DailyHealthData['workouts']): boolean {
  return workouts.some(
    w => timestamp >= w.startDate && timestamp <= w.endDate,
  );
}

function getActivityScore(readings: HRRecord[]): number {
  if (readings.length === 0) return 0.5;
  const sedentaryCount = readings.filter(r => r.motionContext === 1).length;
  const activeCount = readings.filter(r => r.motionContext === 2).length;
  if (activeCount > sedentaryCount) return 1.0;
  if (sedentaryCount > activeCount * 2) return 0.1;
  return 0.5;
}

function computeHrElevationScore(meanBpm: number, baselineHR: number | null): number {
  if (baselineHR === null) return 0;
  const elevation = (meanBpm - baselineHR) / baselineHR;
  if (elevation <= 0.05) return 0;
  if (elevation <= 0.10) return 0.3;
  if (elevation <= 0.20) return 0.6;
  if (elevation <= 0.30) return 0.8;
  return 1.0;
}

function computeHrvDropScore(
  day: DailyHealthData,
  windowStart: Date,
  windowEnd: Date,
  baselineHrv: number | null,
): number {
  if (baselineHrv === null) return 0;

  const windowHrv = day.hrvReadings.filter(
    r => r.timestamp >= windowStart && r.timestamp <= windowEnd,
  );

  if (windowHrv.length === 0) return 0;

  const normalizedValues = windowHrv.map(r => {
    const ratio = getTimeOfDayRatio(r.timestamp.getHours());
    return (r.rmssd ?? r.sdnn) / ratio;
  });

  const mean = normalizedValues.reduce((s, v) => s + v, 0) / normalizedValues.length;
  const drop = (baselineHrv - mean) / baselineHrv;

  if (drop <= 0.05) return 0;
  if (drop <= 0.15) return 0.3;
  if (drop <= 0.25) return 0.6;
  if (drop <= 0.35) return 0.8;
  return 1.0;
}

function computeDurationScore(minutes: number): number {
  if (minutes < MIN_DURATION_MINUTES) return 0;
  if (minutes < 20) return 0.3;
  if (minutes < 40) return 0.6;
  if (minutes < 60) return 0.8;
  return 1.0;
}

function detectStressWindows(day: DailyHealthData, baselines: Baselines): StressEvent[] {
  const hrReadings = [...day.hrReadings].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  if (hrReadings.length < 5) return [];

  const events: StressEvent[] = [];
  const windows: HRWindow[] = [];
  let windowStart = 0;

  for (let i = 0; i < hrReadings.length; i++) {
    while (
      windowStart < i &&
      (hrReadings[i]!.timestamp.getTime() - hrReadings[windowStart]!.timestamp.getTime()) > HR_WINDOW_MINUTES * 60000
    ) {
      windowStart++;
    }

    const windowReadings = hrReadings.slice(windowStart, i + 1);
    if (windowReadings.length >= 3) {
      const meanBpm = windowReadings.reduce((s, r) => s + r.bpm, 0) / windowReadings.length;
      windows.push({
        startTime: windowReadings[0]!.timestamp,
        endTime: windowReadings[windowReadings.length - 1]!.timestamp,
        readings: windowReadings,
        meanBpm,
        maxBpm: Math.max(...windowReadings.map(r => r.bpm)),
      });
    }
  }

  let currentStressStart: Date | null = null;
  let stressReadings: HRRecord[] = [];

  for (const window of windows) {
    const hrElevation = computeHrElevationScore(window.meanBpm, baselines.restingHR7d);
    const activityLevel = getActivityScore(window.readings);
    const duringWorkout = isDuringWorkout(window.startTime, day.workouts ?? []);

    const isStressSignal = hrElevation >= 0.3 && activityLevel < 0.7 && !duringWorkout;

    if (isStressSignal) {
      if (!currentStressStart) {
        currentStressStart = window.startTime;
        stressReadings = [...window.readings];
      } else {
        stressReadings.push(...window.readings);
      }
    } else if (currentStressStart) {
      const event = evaluateStressEvent(
        currentStressStart,
        window.startTime,
        stressReadings,
        day,
        baselines,
      );
      if (event) events.push(event);
      currentStressStart = null;
      stressReadings = [];
    }
  }

  if (currentStressStart && stressReadings.length > 0) {
    const lastReading = stressReadings[stressReadings.length - 1]!;
    const event = evaluateStressEvent(
      currentStressStart,
      lastReading.timestamp,
      stressReadings,
      day,
      baselines,
    );
    if (event) events.push(event);
  }

  return events;
}

function evaluateStressEvent(
  startTime: Date,
  endTime: Date,
  readings: HRRecord[],
  day: DailyHealthData,
  baselines: Baselines,
): StressEvent | null {
  const durationMinutes = (endTime.getTime() - startTime.getTime()) / 60000;
  if (durationMinutes < MIN_DURATION_MINUTES) return null;

  const meanBpm = readings.reduce((s, r) => s + r.bpm, 0) / readings.length;
  const hrvDropScore = computeHrvDropScore(day, startTime, endTime, baselines.hrv7d);
  const hrElevationScore = computeHrElevationScore(meanBpm, baselines.restingHR7d);
  const durationScore = computeDurationScore(durationMinutes);
  const activityLevel = getActivityScore(readings);
  const activityInvertedScore = 1 - activityLevel;

  const confidence =
    STRESS_WEIGHTS.hrvDrop * hrvDropScore +
    STRESS_WEIGHTS.hrElevation * hrElevationScore +
    STRESS_WEIGHTS.duration * durationScore +
    STRESS_WEIGHTS.activityInverted * activityInvertedScore;

  const severity = getStressSeverity(confidence);
  if (severity === 'ignore') return null;

  const duringWorkout = isDuringWorkout(startTime, day.workouts ?? []);

  const parts: string[] = [];
  if (hrElevationScore > 0.3) {
    const elevation = baselines.restingHR7d
      ? `${((meanBpm - baselines.restingHR7d) / baselines.restingHR7d * 100).toFixed(0)}%`
      : `${meanBpm.toFixed(0)} BPM`;
    parts.push(`HR elevated ${elevation} above baseline`);
  }
  if (hrvDropScore > 0.3) parts.push('HRV below time-adjusted baseline');
  parts.push(`sustained ${durationMinutes.toFixed(0)} min`);
  if (activityInvertedScore > 0.5) parts.push('while sedentary');

  return {
    startTime,
    endTime,
    durationMinutes,
    confidence,
    severity,
    components: { hrvDropScore, hrElevationScore, durationScore, activityInvertedScore },
    explanation: parts.join(', '),
    duringWorkout,
  };
}

/**
 * Detect stress events for a single day.
 * Applies cooldown between alerts, max 3 per day.
 */
export function detectDailyStress(
  day: DailyHealthData,
  allDays: Map<string, DailyHealthData>,
): DailyStressSummary {
  const baselines = computeBaselines(day.date, allDays);
  const rawEvents = detectStressWindows(day, baselines);

  rawEvents.sort((a, b) => b.confidence - a.confidence);

  const filteredEvents: StressEvent[] = [];
  for (const event of rawEvents) {
    const tooClose = filteredEvents.some(
      e => Math.abs(event.startTime.getTime() - e.startTime.getTime()) < ALERT_COOLDOWN_MINUTES * 60000,
    );
    if (!tooClose && filteredEvents.length < MAX_ALERTS_PER_DAY) {
      filteredEvents.push(event);
    }
  }

  filteredEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const peakStress = filteredEvents.length > 0
    ? filteredEvents.reduce((max, e) => e.confidence > max.confidence ? e : max)
    : null;

  const totalStressMinutes = filteredEvents.reduce((s, e) => s + e.durationMinutes, 0);
  const fetchAlertTriggered = filteredEvents.some(e => e.confidence >= 0.60);
  const fetchAlertTime = filteredEvents.find(e => e.confidence >= 0.60)?.startTime ?? null;

  return {
    date: day.date,
    events: filteredEvents,
    peakStress,
    totalStressMinutes,
    fetchAlertTriggered,
    fetchAlertTime,
  };
}
