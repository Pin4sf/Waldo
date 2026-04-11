/**
 * CRS (Cognitive Readiness Score) types.
 * Consumer-facing name: "Form" / "Nap Score"
 *
 * Formula: CRS = (Recovery Score × 0.50) + (CASS × 0.35) + (ILAS × 0.15)
 *
 * UI maps to 4 components:
 *   Sleep  → Recovery Score (0.50) — SSQ + RRS + SpO2 + WristTemp
 *   HRV    → CASS              (0.35) — HRVS (Z-score) + RHRTS + WHAS
 *   Circadian → ILAS part      (0.075) — Wake alignment + DAS
 *   Activity  → ILAS part      (0.075) — EES (energy) + Steps/Motion
 *
 * Grounded in SAFTE-FAST (US Army).
 */

/** Individual component score (0-100) */
export interface ComponentScore {
  score: number;
  factors: string[];
  dataAvailable: boolean;
}

/** CRS zone classification */
export type CrsZone = 'peak' | 'moderate' | 'low';

/** Pillar drag analysis — which component is suppressing CRS most */
export interface PillarDrag {
  /** CRS points lost due to each component being below neutral (75) */
  sleep: number;
  hrv: number;
  circadian: number;
  activity: number;
  /** Name of the component responsible for most of the shortfall */
  primary: 'sleep' | 'hrv' | 'circadian' | 'activity' | 'none';
}

/** Full CRS result for a point in time */
export interface CrsResult {
  /** Composite score 0-100, or -1 for insufficient data */
  score: number;
  zone: CrsZone;
  /** 4 UI component scores */
  sleep: ComponentScore;
  hrv: ComponentScore;
  circadian: ComponentScore;
  activity: ComponentScore;
  /** 3 spec pillar scores (mapped from 4 components) */
  pillars: {
    recovery: number;  // = sleep component
    cass: number;      // = hrv component
    ilas: number;      // = avg(circadian, activity)
  };
  /** Pillar drag: how many CRS points each component is pulling down */
  pillarDrag: PillarDrag;
  /** How many components had real data (need ≥3) */
  componentsWithData: number;
  /** Confidence range (e.g., ±8) */
  confidence: number;
  /** Timestamp this CRS was computed for */
  timestamp: Date;
  /** Human-readable summary */
  summary: string;
}

/** CRS computed for a full day */
export interface DailyCrs {
  date: string;
  morningCrs: CrsResult;
  hourlyCrs: CrsResult[];
}

/** Rolling baselines for CRS computation */
export interface Baselines {
  /** 7-day exponential moving average HRV (alpha=0.3) */
  hrv7d: number | null;
  /** 30-day simple moving average HRV */
  hrv30d: number | null;
  /** 30-day standard deviation of HRV — required for Z-score CASS */
  hrv30dSD: number | null;
  /** 7-day average sleep duration in minutes */
  sleepDuration7d: number | null;
  /** 7-day average bedtime (minutes from midnight, normalized) */
  bedtime7d: number | null;
  /** Estimated chronotype from 14-day sleep midpoint */
  chronotype: 'early' | 'normal' | 'late';
  /** 7-day average resting HR */
  restingHR7d: number | null;
  /** 7-day average daily active energy burned (kcal) */
  activeEnergy7d: number | null;
  /** 30-day average daily active energy burned (kcal) — for EES baseline (spec uses 30d×2 as 48h baseline) */
  activeEnergy30d: number | null;
  /** Number of days of historical data available */
  daysOfData: number;
}

/**
 * CRS weights — spec-accurate.
 * Sleep/Recovery = 0.50, HRV/CASS = 0.35, Circadian+Activity = ILAS = 0.15 total.
 */
export const CRS_WEIGHTS = {
  sleep: 0.50,      // Recovery Score (SSQ + RRS + SpO2 + WristTemp)
  hrv: 0.35,        // CASS (HRVS Z-score + RHRTS + WHAS)
  circadian: 0.075, // ILAS part — wake alignment + DAS
  activity: 0.075,  // ILAS part — EES + Steps + Motion
} as const;

/** Time-of-day HRV normalization ratios (spec Table) */
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

/** CRS zone thresholds */
export function getCrsZone(score: number): CrsZone {
  if (score >= 80) return 'peak';
  if (score >= 50) return 'moderate';
  return 'low';
}
