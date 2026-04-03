/**
 * Stress detection types.
 * PORTED FROM tools/health-parser/src/types/stress.ts — DO NOT MODIFY ALGORITHM.
 *
 * Consumer-facing names: "The Sniff" (detection engine), "Fetch Alert" (the alert)
 * Confidence = 0.35×(HRV drop) + 0.25×(HR elevation) + 0.20×(duration) + 0.20×(1 - activity)
 */

/** Stress confidence thresholds */
export const STRESS_THRESHOLDS = {
  HIGH: 0.80,
  MODERATE: 0.60,
  LOG: 0.40,
  IGNORE: 0.40,
} as const;

/** Stress confidence weights */
export const STRESS_WEIGHTS = {
  hrvDrop: 0.35,
  hrElevation: 0.25,
  duration: 0.20,
  activityInverted: 0.20,
} as const;

export type StressSeverity = 'high' | 'moderate' | 'log' | 'ignore';

/** A detected stress event */
export interface StressEvent {
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  confidence: number;
  severity: StressSeverity;
  components: {
    hrvDropScore: number;
    hrElevationScore: number;
    durationScore: number;
    activityInvertedScore: number;
  };
  explanation: string;
  duringWorkout: boolean;
}

/** Daily stress summary */
export interface DailyStressSummary {
  date: string;
  events: StressEvent[];
  peakStress: StressEvent | null;
  totalStressMinutes: number;
  fetchAlertTriggered: boolean;
  fetchAlertTime: Date | null;
}

export function getStressSeverity(confidence: number): StressSeverity {
  if (confidence >= STRESS_THRESHOLDS.HIGH) return 'high';
  if (confidence >= STRESS_THRESHOLDS.MODERATE) return 'moderate';
  if (confidence >= STRESS_THRESHOLDS.LOG) return 'log';
  return 'ignore';
}
