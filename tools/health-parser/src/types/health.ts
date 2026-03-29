/**
 * Core health data types extracted from Apple Health XML.
 * These are the raw records organized by type — the input to CRS computation.
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
  /** Time string from XML (e.g., "11:37:51.73 PM") */
  timeStr: string;
}

/** A single HRV record with optional raw beats for RMSSD computation */
export interface HRVRecord {
  timestamp: Date;
  /** SDNN in ms (Apple's exported value) */
  sdnn: number;
  /** Raw instantaneous BPM samples — used to compute RMSSD */
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
  /** Date this sleep is attributed to (the "night of") */
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

/** Daily activity summary from Apple's ActivitySummary */
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

/** Workout record with weather metadata */
export interface WorkoutRecord {
  activityType: string;
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  totalEnergyBurned: number;
  totalDistance: number;
  source: string;
  /** Weather during workout (from Apple Health metadata) */
  weather?: {
    temperatureF: number;
    humidity: number;
    indoor: boolean;
  };
  avgMETs?: number;
}

/** Sleeping wrist temperature deviation */
export interface WristTempRecord {
  timestamp: Date;
  temperatureC: number;
  source: string;
}

/** Resting heart rate (Apple's daily computed value) */
export interface RestingHRRecord {
  timestamp: Date;
  bpm: number;
  source: string;
}

/** Environmental audio exposure */
export interface AudioExposureRecord {
  timestamp: Date;
  dbLevel: number;
  source: string;
}

/** Time spent in daylight */
export interface DaylightRecord {
  startDate: Date;
  endDate: Date;
  minutes: number;
  source: string;
}

/** Walking/running distance record */
export interface DistanceRecord {
  startDate: Date;
  endDate: Date;
  km: number;
  source: string;
}

/** Walking speed record */
export interface WalkingSpeedRecord {
  timestamp: Date;
  kmPerHour: number;
  source: string;
}

/** User profile extracted from the Me element */
export interface UserProfile {
  dateOfBirth: string;
  biologicalSex: string;
  age: number;
}

/** All extracted health data, organized by type */
export interface ExtractedHealthData {
  profile: UserProfile;
  heartRate: HRRecord[];
  hrv: HRVRecord[];
  sleepStages: SleepStageRecord[];
  spo2: SpO2Record[];
  respiratoryRate: RespiratoryRateRecord[];
  activitySummaries: ActivitySummary[];
  steps: StepRecord[];
  workouts: WorkoutRecord[];
  wristTemperature: WristTempRecord[];
  restingHR: RestingHRRecord[];
  audioExposure: AudioExposureRecord[];
  daylight: DaylightRecord[];
  distance: DistanceRecord[];
  walkingSpeed: WalkingSpeedRecord[];
  activeEnergy: Array<{ timestamp: Date; kcal: number }>;
  flightsClimbed: Array<{ timestamp: Date; flights: number }>;
  vo2max: Array<{ timestamp: Date; value: number }>;
  /** Metadata about the export */
  exportDate: Date;
  recordCount: number;
}

/** Health data for a single day — used by CRS engine */
export interface DailyHealthData {
  date: string;
  sleep: SleepSession | null;
  /** HRV records for this day */
  hrvReadings: HRVRecord[];
  /** HR records for this day */
  hrReadings: HRRecord[];
  /** Resting HR estimate (lowest 10th percentile of sedentary readings) */
  restingHR: number | null;
  /** Apple's computed resting HR (if available) */
  appleRestingHR: number | null;
  /** Daily step total */
  totalSteps: number;
  /** Exercise minutes */
  exerciseMinutes: number;
  /** SpO2 readings */
  spo2Readings: SpO2Record[];
  /** Respiratory rate readings */
  respiratoryReadings: RespiratoryRateRecord[];
  /** Activity summary if available */
  activitySummary: ActivitySummary | null;
  /** Workouts */
  workouts: WorkoutRecord[];
  /** Sleeping wrist temperature (deviation from baseline, °C) */
  wristTemp: number | null;
  /** Average environmental noise level (dB) */
  avgNoiseDb: number | null;
  /** Time spent in daylight (minutes) */
  daylightMinutes: number;
  /** Weather conditions (from workout metadata or Open-Meteo) */
  weather: {
    temperatureF: number;
    humidity: number;
    source: 'workout' | 'api';
  } | null;
  /** Walking/running distance in km */
  distanceKm: number;
  /** Average walking speed km/h */
  avgWalkingSpeed: number | null;
  /** Flights of stairs climbed */
  flightsClimbed: number;
  /** Active energy burned in kcal */
  activeEnergyBurned: number;
  /** VO2Max if measured today */
  vo2max: number | null;
  /** Air Quality Index (US standard, from Open-Meteo) */
  aqi: number | null;
  /** PM2.5 particulate matter */
  pm25: number | null;
}
