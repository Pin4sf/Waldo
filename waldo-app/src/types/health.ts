/**
 * Core health data types for the Waldo app.
 * Ported from tools/health-parser/src/types/health.ts — types are identical
 * to ensure CRS engine produces consistent results across parser and app.
 */

/** A single heart rate reading */
export interface HRRecord {
  timestamp: Date;
  bpm: number;
  /** 0 = not set, 1 = sedentary, 2 = active */
  motionContext: 0 | 1 | 2;
  source: string;
}

/** Raw instantaneous beat from HRV metadata */
export interface InstantaneousBeat {
  bpm: number;
  /** Time string or ISO timestamp */
  timeStr: string;
}

/** A single HRV record with optional raw beats for RMSSD computation */
export interface HRVRecord {
  timestamp: Date;
  /** SDNN in ms (Apple's exported value, or Health Connect equivalent) */
  sdnn: number;
  /** Raw instantaneous BPM samples — used to compute RMSSD on-phone */
  beats: InstantaneousBeat[];
  /** Computed RMSSD from raw beats (null if beats unavailable) */
  rmssd: number | null;
  source: string;
}

/** Sleep stage types matching Apple HealthKit */
export type SleepStage = 'inBed' | 'asleepCore' | 'asleepDeep' | 'asleepREM' | 'awake';

/** A single sleep stage record */
export interface SleepStageRecord {
  stage: SleepStage;
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  source: string;
}

/** Aggregated sleep session for one night */
export interface SleepSession {
  /** Date this sleep is attributed to (the "night of") — 'YYYY-MM-DD' */
  date: string;
  bedtime: Date;
  wakeTime: Date;
  totalDurationMinutes: number;
  stages: {
    inBed: number;
    core: number;
    deep: number;
    rem: number;
    awake: number;
  };
  /** deep + core + rem / total in-bed time */
  efficiency: number;
  /** Percentage of total sleep that is deep */
  deepPercent: number;
  /** Percentage of total sleep that is REM */
  remPercent: number;
  records: SleepStageRecord[];
}

/** A single SpO2 reading */
export interface SpO2Record {
  timestamp: Date;
  percentage: number;
  source: string;
}

/** A single respiratory rate reading */
export interface RespiratoryRateRecord {
  timestamp: Date;
  breathsPerMinute: number;
  source: string;
}

/** Daily activity summary */
export interface ActivitySummary {
  date: string;
  activeEnergyBurned: number;
  appleMoveTime: number;
  appleExerciseTime: number;
  appleStandHours: number;
}

/** Step count record */
export interface StepRecord {
  startDate: Date;
  endDate: Date;
  steps: number;
  source: string;
}

/** Resting heart rate */
export interface RestingHRRecord {
  timestamp: Date;
  bpm: number;
  source: string;
}

/** Workout record (simplified — full detail added in Phase C) */
export interface WorkoutRecord {
  activityType: string;
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  totalEnergyBurned: number;
  totalDistance: number;
  source: string;
}

/** Health data for a single day — primary input to the CRS engine */
export interface DailyHealthData {
  date: string;
  sleep: SleepSession | null;
  hrvReadings: HRVRecord[];
  hrReadings: HRRecord[];
  restingHR: number | null;
  appleRestingHR: number | null;
  totalSteps: number;
  exerciseMinutes: number;
  spo2Readings: SpO2Record[];
  respiratoryReadings: RespiratoryRateRecord[];
  activitySummary: ActivitySummary | null;
  wristTemp: number | null;
  avgNoiseDb: number | null;
  daylightMinutes: number;
  weather: {
    temperatureF: number;
    humidity: number;
    source: 'workout' | 'api';
  } | null;
  distanceKm: number;
  flightsClimbed: number;
  activeEnergyBurned: number;
  vo2max: number | null;
  aqi: number | null;
  pm25: number | null;
  /** Workouts (populated from Phase C+) */
  workouts: WorkoutRecord[];
}

/** Query parameters for date-range health data requests */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}
