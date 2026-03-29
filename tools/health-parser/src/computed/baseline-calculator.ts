/**
 * Baseline calculator for CRS computation.
 * Computes rolling 7-day EMA and 30-day SMA for HRV, sleep, and HR.
 * Estimates chronotype from 14-day sleep midpoint.
 */
import type { DailyHealthData, SleepSession } from '../types/health.js';
import type { Baselines } from '../types/crs.js';

/**
 * Compute exponential moving average.
 * alpha = 0.3 per spec (more weight on recent days).
 */
function ema(values: number[], alpha = 0.3): number | null {
  if (values.length === 0) return null;
  let result = values[0]!;
  for (let i = 1; i < values.length; i++) {
    result = alpha * values[i]! + (1 - alpha) * result;
  }
  return result;
}

/** Simple moving average */
function sma(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Get minutes from midnight for a Date */
function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Get daily mean RMSSD (or SDNN fallback) for a day */
function getDailyHrvValue(day: DailyHealthData): number | null {
  const readings = day.hrvReadings;
  if (readings.length === 0) return null;

  // Prefer RMSSD computed from raw beats
  const rmssdValues = readings.map(r => r.rmssd).filter((v): v is number => v !== null);
  if (rmssdValues.length > 0) {
    return sma(rmssdValues);
  }

  // Fall back to SDNN
  const sdnnValues = readings.map(r => r.sdnn);
  return sma(sdnnValues);
}

/**
 * Estimate chronotype from sleep midpoints.
 * Uses last 14 days of sleep data.
 * Early: midpoint < 3:00 AM → peak ~10am
 * Normal: midpoint 3:00-4:30 AM → peak ~11:30am
 * Late: midpoint > 4:30 AM → peak ~1pm
 */
function estimateChronotype(sleepSessions: (SleepSession | null)[]): 'early' | 'normal' | 'late' {
  const midpoints: number[] = [];

  for (const session of sleepSessions) {
    if (!session) continue;
    const bedMinutes = minutesFromMidnight(session.bedtime);
    const wakeMinutes = minutesFromMidnight(session.wakeTime);

    // Handle cross-midnight bedtimes
    const adjustedBed = bedMinutes > 720 ? bedMinutes - 1440 : bedMinutes;
    const midpoint = (adjustedBed + wakeMinutes) / 2;
    // Normalize back to 0-1440
    midpoints.push(midpoint < 0 ? midpoint + 1440 : midpoint);
  }

  if (midpoints.length < 3) return 'normal';

  const avgMidpoint = midpoints.reduce((s, v) => s + v, 0) / midpoints.length;
  // Convert to hours
  const midpointHours = avgMidpoint / 60;

  if (midpointHours < 3) return 'early';
  if (midpointHours <= 4.5) return 'normal';
  return 'late';
}

/**
 * Compute baselines for a given date using historical data.
 * Looks back 7 days for EMA, 30 days for SMA.
 */
export function computeBaselines(
  targetDate: string,
  allDays: Map<string, DailyHealthData>,
): Baselines {
  const sortedDates = [...allDays.keys()].sort();
  const targetIdx = sortedDates.indexOf(targetDate);

  // Get up to 30 days of prior data (not including target)
  const lookback30 = sortedDates.slice(Math.max(0, targetIdx - 30), targetIdx);
  const lookback7 = lookback30.slice(-7);
  const lookback14 = lookback30.slice(-14);

  // HRV baselines
  const hrvValues7d = lookback7
    .map(d => getDailyHrvValue(allDays.get(d)!))
    .filter((v): v is number => v !== null);
  const hrvValues30d = lookback30
    .map(d => getDailyHrvValue(allDays.get(d)!))
    .filter((v): v is number => v !== null);

  // Sleep duration baselines
  const sleepDurations7d = lookback7
    .map(d => allDays.get(d)!.sleep?.totalDurationMinutes)
    .filter((v): v is number => v !== undefined);

  // Bedtime baselines
  const bedtimes7d = lookback7
    .map(d => {
      const sleep = allDays.get(d)!.sleep;
      if (!sleep) return null;
      const mins = minutesFromMidnight(sleep.bedtime);
      return mins > 720 ? mins - 1440 : mins; // Normalize for cross-midnight
    })
    .filter((v): v is number => v !== null);

  // Resting HR baselines
  const restingHR7d = lookback7
    .map(d => allDays.get(d)!.restingHR)
    .filter((v): v is number => v !== null);

  // Chronotype from 14-day sleep
  const sleepSessions14d = lookback14.map(d => allDays.get(d)!.sleep);

  return {
    hrv7d: ema(hrvValues7d),
    hrv30d: sma(hrvValues30d),
    sleepDuration7d: sma(sleepDurations7d),
    bedtime7d: sma(bedtimes7d),
    chronotype: estimateChronotype(sleepSessions14d),
    restingHR7d: sma(restingHR7d),
    daysOfData: lookback7.length,
  };
}
