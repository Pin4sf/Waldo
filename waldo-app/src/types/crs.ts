/**
 * CRS (Cognitive Readiness Score) result types.
 * Ported from tools/health-parser/src/types/crs.ts.
 * Consumer-facing name: "Nap Score".
 */

/** Individual CRS component — one of four factors */
export interface CrsComponent {
  score: number;       // 0-100
  weight: number;      // fractional weight (e.g. 0.35)
  label: string;
  available: boolean;  // false if underlying data was missing
}

/** The full CRS result for a single day */
export type CrsResult =
  | {
      status: 'ready';
      /** Overall CRS / Nap Score (0-100) */
      score: number;
      components: {
        sleepRecovery: CrsComponent;
        hrvBalance: CrsComponent;
        circadianAlignment: CrsComponent;
        activityBalance: CrsComponent;
      };
      /** Cognitive readiness zone */
      zone: CrsZone;
      /** ISO date string for this CRS ('YYYY-MM-DD') */
      date: string;
      /** Timestamp when this CRS was computed */
      computedAt: Date;
      /** HRV data source used */
      deviceHrvSource: DeviceHrvSource;
      /** Whether baselines are personal (7+ days) or population defaults */
      baselineSource: 'personal' | 'population';
      dataQuality: DataQuality;
    }
  | {
      status: 'insufficient';
      reason: InsufficientReason;
      date: string;
      availableComponents: number;
      missingComponents: string[];
    };

export type CrsZone =
  | 'optimal'    // 80-100
  | 'good'       // 65-79
  | 'moderate'   // 50-64
  | 'low';       // 0-49

export type DeviceHrvSource =
  | 'healthkit_ibi'       // True RMSSD from beat-to-beat data (most accurate)
  | 'healthkit_sdnn'      // SDNN fallback (converted to RMSSD-equivalent)
  | 'health_connect_rmssd'
  | 'hr_proxy'            // Samsung: HR-based HRV proxy
  | 'none';               // No HRV data available

export type InsufficientReason =
  | 'not_enough_data'      // Fewer than 3 components available
  | 'no_sleep_data'        // Sleep component (35%) unavailable
  | 'first_use'            // < 1 day of data
  | 'watch_not_worn';      // All sources null

export interface DataQuality {
  /** Whether personal baselines are established (7+ days) */
  hasPersonalBaseline: boolean;
  /** Days of data available */
  dataDays: number;
  /** HRV sample count for today */
  hrvSampleCount: number;
  /** Whether sleep data was present */
  hasSleepData: boolean;
  /** Whether CRS value was clamped (extreme inputs) */
  wasClamped: boolean;
}

/** Rolling baselines used by the CRS engine */
export interface Baselines {
  /** 7-day rolling average HRV (RMSSD or converted SDNN) */
  hrv7day: number | null;
  /** 30-day rolling average HRV */
  hrv30day: number | null;
  /** Resting HR baseline */
  restingHrBaseline: number | null;
  /** Average sleep duration in minutes (30-day) */
  avgSleepMinutes: number | null;
  /** 14-day cumulative sleep debt in minutes */
  sleepDebtMinutes: number;
  /** Chronotype midpoint (hours past midnight, e.g. 3.0 = 3 AM) */
  chronotypeMidpoint: number | null;
  /** Inferred peak alertness hour (0-23) */
  peakAlertHour: number | null;
  /** How many days of data contributed to these baselines */
  dataDays: number;
  /** Source of baselines */
  source: 'personal' | 'population';
}
