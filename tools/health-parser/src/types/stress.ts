/**
 * Stress detection types.
 * Consumer-facing name: "The Sniff" (detection engine), "Fetch Alert" (the alert)
 *
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
  /** When the stress signal started */
  startTime: Date;
  /** When the stress signal ended (or last measurement) */
  endTime: Date;
  /** Duration in minutes */
  durationMinutes: number;
  /** Overall confidence 0.0-1.0 */
  confidence: number;
  severity: StressSeverity;
  /** Component breakdown */
  components: {
    /** How much HRV dropped from baseline (0-1 normalized) */
    hrvDropScore: number;
    /** How much HR elevated above baseline (0-1 normalized) */
    hrElevationScore: number;
    /** Duration factor (0-1, scales with sustained minutes) */
    durationScore: number;
    /** Inverted activity — low activity + cardiac stress = real stress */
    activityInvertedScore: number;
  };
  /** Human-readable explanation */
  explanation: string;
  /** Was this during a known workout? (if so, likely false positive) */
  duringWorkout: boolean;
}

/** Daily stress summary */
export interface DailyStressSummary {
  date: string;
  events: StressEvent[];
  /** Highest confidence event of the day */
  peakStress: StressEvent | null;
  /** Total minutes in elevated stress */
  totalStressMinutes: number;
  /** Would a Fetch Alert have fired? */
  fetchAlertTriggered: boolean;
  /** When would the Fetch Alert have fired? */
  fetchAlertTime: Date | null;
}

export function getStressSeverity(confidence: number): StressSeverity {
  if (confidence >= STRESS_THRESHOLDS.HIGH) return 'high';
  if (confidence >= STRESS_THRESHOLDS.MODERATE) return 'moderate';
  if (confidence >= STRESS_THRESHOLDS.LOG) return 'log';
  return 'ignore';
}
