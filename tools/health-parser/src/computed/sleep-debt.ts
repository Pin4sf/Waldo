/**
 * Sleep Debt Calculator
 *
 * 14-day weighted rolling debt. Last night = 15% weight,
 * remaining 85% distributed across prior 13 nights with recency bias.
 *
 * Sleep need: 7.5h default (adjustable).
 * Debt accumulates when actual < need. Repays at 0.5x rate (1h extra = 0.5h repaid).
 */
import type { DailyHealthData } from '../types/health.js';

const SLEEP_NEED_HOURS = 7.5;
const LOOKBACK_DAYS = 14;
const REPAY_RATE = 0.5; // 1h extra sleep repays 0.5h debt

export interface SleepDebtResult {
  /** Current accumulated debt in hours */
  debtHours: number;
  /** Direction: accumulating or paying off */
  direction: 'accumulating' | 'paying_off' | 'stable';
  /** Debt 7 days ago (for trend) */
  debtSevenDaysAgo: number;
  /** Nights below need in last 14 days */
  shortNights: number;
  /** Average sleep in the window */
  avgSleepHours: number;
  /** Human readable summary */
  summary: string;
}

export function computeSleepDebt(
  date: string,
  allDays: Map<string, DailyHealthData>,
): SleepDebtResult {
  const sortedDates = [...allDays.keys()].sort();
  const idx = sortedDates.indexOf(date);
  if (idx < 0) return emptyResult();

  const lookback = sortedDates.slice(Math.max(0, idx - LOOKBACK_DAYS), idx + 1);
  if (lookback.length === 0) return emptyResult();

  // Compute weighted debt: most recent night has highest weight
  let totalDebt = 0;
  let shortNights = 0;
  const sleepHours: number[] = [];

  for (let i = 0; i < lookback.length; i++) {
    const day = allDays.get(lookback[i]!)!;
    const hours = day.sleep ? day.sleep.totalDurationMinutes / 60 : 0;
    sleepHours.push(hours);

    if (!day.sleep) continue; // No data — don't count

    // Weight: exponential recency (most recent = highest)
    const recency = (i + 1) / lookback.length;
    const weight = Math.pow(recency, 1.5); // Gentle exponential

    const deficit = SLEEP_NEED_HOURS - hours;
    if (deficit > 0) {
      totalDebt += deficit * weight;
      shortNights++;
    } else {
      // Repaying debt at reduced rate
      totalDebt -= Math.abs(deficit) * REPAY_RATE * weight;
    }
  }

  totalDebt = Math.max(0, totalDebt);
  const debtHours = Math.round(totalDebt * 10) / 10;

  // Compute debt from 7 days ago for trend
  const lookback7ago = sortedDates.slice(Math.max(0, idx - LOOKBACK_DAYS - 7), Math.max(0, idx - 7) + 1);
  let debt7ago = 0;
  for (let i = 0; i < lookback7ago.length; i++) {
    const day = allDays.get(lookback7ago[i]!)!;
    if (!day.sleep) continue;
    const hours = day.sleep.totalDurationMinutes / 60;
    const recency = (i + 1) / lookback7ago.length;
    const weight = Math.pow(recency, 1.5);
    const deficit = SLEEP_NEED_HOURS - hours;
    if (deficit > 0) debt7ago += deficit * weight;
    else debt7ago -= Math.abs(deficit) * REPAY_RATE * weight;
  }
  debt7ago = Math.max(0, Math.round(debt7ago * 10) / 10);

  const direction = debtHours > debt7ago + 0.5 ? 'accumulating'
    : debtHours < debt7ago - 0.5 ? 'paying_off'
    : 'stable';

  const avgSleep = sleepHours.filter(h => h > 0).length > 0
    ? sleepHours.filter(h => h > 0).reduce((s, h) => s + h, 0) / sleepHours.filter(h => h > 0).length
    : 0;

  let summary: string;
  if (debtHours < 1) summary = 'Sleep debt is low. Well rested.';
  else if (debtHours < 3) summary = `${debtHours}h sleep debt. Manageable — one good night helps.`;
  else if (debtHours < 6) summary = `${debtHours}h sleep debt. Building up — takes ~${Math.ceil(debtHours / REPAY_RATE)} nights of extra sleep to clear.`;
  else summary = `${debtHours}h sleep debt. Significant — recovery will take over a week.`;

  return {
    debtHours,
    direction,
    debtSevenDaysAgo: debt7ago,
    shortNights,
    avgSleepHours: Math.round(avgSleep * 10) / 10,
    summary,
  };
}

function emptyResult(): SleepDebtResult {
  return { debtHours: 0, direction: 'stable', debtSevenDaysAgo: 0, shortNights: 0, avgSleepHours: 0, summary: 'No sleep data.' };
}
