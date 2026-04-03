/**
 * Aggregates raw HealthKit query results into DailyHealthData.
 *
 * This is the bridge between the native module output and the CRS engine.
 * Handles the critical UTC → local timezone conversion for sleep sessions.
 *
 * Phase A0 hard-won lesson: sleep records from HealthKit use UTC timestamps.
 * The "night of" date must be determined using local timezone, not UTC.
 * A user who sleeps 11pm–7am in UTC-5 has sleep that appears as 4am–12pm UTC.
 * Without local-time conversion, this gets attributed to the wrong night.
 */

import type {
  HRVRecord,
  HRRecord,
  RestingHRRecord,
  SleepStageRecord,
  StepRecord,
  SpO2Record,
  RespiratoryRateRecord,
  DailyHealthData,
  SleepSession,
  SleepStage,
  ActivitySummary,
} from '@/types/health';

export interface RawHealthData {
  hrv: HRVRecord[];
  heartRate: HRRecord[];
  restingHR: RestingHRRecord[];
  sleep: SleepStageRecord[];
  steps: StepRecord[];
  spo2: SpO2Record[];
  respiratoryRate: RespiratoryRateRecord[];
}

/**
 * Convert raw HealthKit records to DailyHealthData for a specific date.
 * The date parameter is 'YYYY-MM-DD' in LOCAL time.
 */
export function aggregateDailyData(
  date: string,
  raw: RawHealthData,
): DailyHealthData {
  const sleep = aggregateSleep(date, raw.sleep);
  const restingHR = extractRestingHR(raw.restingHR, raw.heartRate);

  return {
    date,
    sleep,
    hrvReadings: raw.hrv,
    hrReadings: raw.heartRate,
    restingHR,
    appleRestingHR: raw.restingHR[0]?.bpm ?? null,
    totalSteps: raw.steps.reduce((sum, s) => sum + s.steps, 0),
    exerciseMinutes: 0, // populated from workouts in Phase C+
    spo2Readings: raw.spo2,
    respiratoryReadings: raw.respiratoryRate,
    activitySummary: null, // Activity summary not available in Phase B1 from HealthKit directly
    wristTemp: null,
    avgNoiseDb: null,
    daylightMinutes: 0,
    weather: null,
    distanceKm: 0,
    flightsClimbed: 0,
    activeEnergyBurned: 0,
    vo2max: null,
    aqi: null,
    pm25: null,
    workouts: [],
  };
}

/**
 * Aggregate sleep stage records into a SleepSession for a given date.
 *
 * CRITICAL: timestamps from HealthKit are UTC. We convert to local time
 * before determining which "night" a session belongs to.
 * A sleep record at 04:00 UTC = 23:00 local time for UTC-5, which
 * belongs to "the night before" in UTC, but "tonight" in local time.
 */
function aggregateSleep(date: string, records: SleepStageRecord[]): SleepSession | null {
  if (records.length === 0) return null;

  // Filter to records that belong to this night in LOCAL time
  // "This night" = records between previous day 6pm and this day 11am (local)
  const targetDate = new Date(date + 'T00:00:00'); // local midnight
  const windowStart = new Date(targetDate.getTime() - 6 * 60 * 60 * 1000); // prev 6pm local
  const windowEnd = new Date(targetDate.getTime() + 11 * 60 * 60 * 1000);  // 11am this day

  const nightRecords = records.filter(r => {
    const localStart = r.startDate; // already a Date object
    return localStart >= windowStart && localStart <= windowEnd;
  });

  if (nightRecords.length === 0) return null;

  // Exclude inBed-only sessions
  const hasActualSleep = nightRecords.some(r => r.stage !== 'inBed' && r.stage !== 'awake');
  if (!hasActualSleep) return null;

  const stages: SleepSession['stages'] = {
    inBed: 0,
    core: 0,
    deep: 0,
    rem: 0,
    awake: 0,
  };

  for (const r of nightRecords) {
    switch (r.stage as SleepStage) {
      case 'inBed': stages.inBed += r.durationMinutes; break;
      case 'asleepCore': stages.core += r.durationMinutes; break;
      case 'asleepDeep': stages.deep += r.durationMinutes; break;
      case 'asleepREM': stages.rem += r.durationMinutes; break;
      case 'awake': stages.awake += r.durationMinutes; break;
    }
  }

  const totalSleepMinutes = stages.core + stages.deep + stages.rem;
  const totalInBedMinutes = stages.inBed + totalSleepMinutes + stages.awake;

  if (totalSleepMinutes < 60) return null; // Less than 1h — not a real sleep session

  const sortedRecords = [...nightRecords].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const bedtime = sortedRecords[0]!.startDate;
  const wakeTime = sortedRecords[sortedRecords.length - 1]!.endDate;

  const efficiency = totalInBedMinutes > 0 ? totalSleepMinutes / totalInBedMinutes : 0;
  const deepPercent = totalSleepMinutes > 0 ? stages.deep / totalSleepMinutes : 0;
  const remPercent = totalSleepMinutes > 0 ? stages.rem / totalSleepMinutes : 0;

  return {
    date,
    bedtime,
    wakeTime,
    totalDurationMinutes: totalSleepMinutes,
    stages,
    efficiency,
    deepPercent,
    remPercent,
    records: nightRecords,
  };
}

/**
 * Extract resting HR from Apple's computed value or estimate from HR samples.
 * Uses the 10th percentile of sedentary HR readings as a proxy.
 */
function extractRestingHR(
  restingHRRecords: RestingHRRecord[],
  hrRecords: HRRecord[],
): number | null {
  // Prefer Apple's computed resting HR
  if (restingHRRecords.length > 0) {
    const values = restingHRRecords.map(r => r.bpm).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)] ?? null; // Median
  }

  // Fall back to 10th percentile of sedentary HR
  const sedentary = hrRecords
    .filter(r => r.motionContext === 1)
    .map(r => r.bpm)
    .sort((a, b) => a - b);

  if (sedentary.length < 5) return null;

  const p10Index = Math.floor(sedentary.length * 0.10);
  return sedentary[p10Index] ?? null;
}

/**
 * Get the date string ('YYYY-MM-DD') for "today" in local time.
 */
export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get start/end dates for a 24-hour window ending now, in local time.
 * Used for "today" queries to HealthKit.
 */
export function getTodayRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0, 0, 0, 0
  );
  return { startDate: startOfDay, endDate: now };
}

/**
 * Get start/end for a "last night" sleep window.
 * 6pm yesterday → 11am today (local time).
 */
export function getLastNightRange(): { startDate: Date; endDate: Date } {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return {
    startDate: new Date(todayMidnight.getTime() - 6 * 60 * 60 * 1000), // 6pm yesterday
    endDate: new Date(todayMidnight.getTime() + 11 * 60 * 60 * 1000),   // 11am today
  };
}
