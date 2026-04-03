/**
 * CRS engine-internal types.
 * PORTED FROM tools/health-parser/src/types/crs.ts — DO NOT MODIFY ALGORITHM.
 *
 * These types are used ONLY by the CRS engine (crs-engine.ts, baseline-calculator.ts).
 * The 856-day validation is only valid against this exact type structure.
 *
 * For UI/storage, see src/types/crs.ts.
 */

/** Individual component score (0-100) */
export interface ComponentScore {
  score: number;
  /** What contributed to this score (non-health-value factors) */
  factors: string[];
  /** Data quality: did we have enough data? */
  dataAvailable: boolean;
}

/** CRS zone classification */
export type CrsZone = 'peak' | 'moderate' | 'low';

/** Full CRS result for a single day */
export interface CrsResult {
  /** Composite score 0-100, or -1 for insufficient data */
  score: number;
  zone: CrsZone;
  /** Component breakdown */
  sleep: ComponentScore;
  hrv: ComponentScore;
  circadian: ComponentScore;
  activity: ComponentScore;
  /** How many components had real data (need ≥3) */
  componentsWithData: number;
  /** Confidence range (e.g., ±8) — wider with less data */
  confidence: number;
  /** Timestamp this CRS was computed for */
  timestamp: Date;
  /** Human-readable summary */
  summary: string;
}

/** Rolling baselines for CRS computation */
export interface Baselines {
  /** 7-day exponential moving average (alpha=0.3) */
  hrv7d: number | null;
  /** 30-day simple moving average */
  hrv30d: number | null;
  /** 7-day average sleep duration in minutes */
  sleepDuration7d: number | null;
  /** 7-day average bedtime (minutes from midnight) */
  bedtime7d: number | null;
  /** Estimated chronotype from 14-day sleep midpoint */
  chronotype: 'early' | 'normal' | 'late';
  /** Average resting HR over 7 days */
  restingHR7d: number | null;
  /** Number of days of data used */
  daysOfData: number;
}

/** CRS weights — locked per spec */
export const CRS_WEIGHTS = {
  sleep: 0.35,
  hrv: 0.25,
  circadian: 0.25,
  activity: 0.15,
} as const;

/** Time-of-day HRV normalization ratios (6-block, population averages) */
export const TIME_OF_DAY_RATIOS: Record<string, number> = {
  '00-04': 1.30,
  '04-08': 1.10,
  '08-12': 1.00,
  '12-16': 0.85,
  '16-20': 0.90,
  '20-24': 1.05,
};

export function getTimeOfDayRatio(hour: number): number {
  if (hour < 4) return TIME_OF_DAY_RATIOS['00-04']!;
  if (hour < 8) return TIME_OF_DAY_RATIOS['04-08']!;
  if (hour < 12) return TIME_OF_DAY_RATIOS['08-12']!;
  if (hour < 16) return TIME_OF_DAY_RATIOS['12-16']!;
  if (hour < 20) return TIME_OF_DAY_RATIOS['16-20']!;
  return TIME_OF_DAY_RATIOS['20-24']!;
}

export function getCrsZone(score: number): CrsZone {
  if (score >= 80) return 'peak';
  if (score >= 50) return 'moderate';
  return 'low';
}
