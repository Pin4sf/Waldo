/**
 * Organizes raw extracted health data into daily buckets.
 * Groups sleep stages into sessions, computes daily step totals,
 * estimates resting HR, and builds DailyHealthData for each day.
 */
import type {
  ExtractedHealthData,
  DailyHealthData,
  SleepSession,
  SleepStageRecord,
  HRRecord,
} from '../types/index.js';

/**
 * Format date as YYYY-MM-DD in IST (Asia/Kolkata, UTC+5:30).
 *
 * CRITICAL: toISOString() converts to UTC, which misattributes
 * records from 00:00-05:29 IST to the previous calendar day.
 * We offset by +5:30 to get the correct local date.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  const local = new Date(d.getTime() + IST_OFFSET_MS);
  return local.toISOString().slice(0, 10);
}

/**
 * Attribute a sleep record to a "night" date.
 * Sleep that starts before 6 PM → same day. After 6 PM → next day.
 * This means "the night of Oct 22" (sleep starting 10pm Oct 22) is attributed to Oct 23.
 * We use the END date's calendar day as the attribution date.
 */
function sleepNightDate(endDate: Date): string {
  return dateKey(endDate);
}

/**
 * Group sleep stage records into sessions.
 * A session is a contiguous block of sleep stages with gaps < 2 hours.
 */
function groupSleepSessions(stages: SleepStageRecord[]): SleepSession[] {
  if (stages.length === 0) return [];

  // Sort by start date
  const sorted = [...stages].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const sessions: SleepSession[] = [];
  let currentStages: SleepStageRecord[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentStages[currentStages.length - 1]!;
    const curr = sorted[i]!;
    const gapMinutes = (curr.startDate.getTime() - prev.endDate.getTime()) / 60000;

    if (gapMinutes > 120) {
      // Gap > 2h — new session
      const session = buildSleepSession(currentStages);
      if (session) sessions.push(session);
      currentStages = [curr];
    } else {
      currentStages.push(curr);
    }
  }

  // Final session
  const lastSession = buildSleepSession(currentStages);
  if (lastSession) sessions.push(lastSession);

  return sessions;
}

function buildSleepSession(stages: SleepStageRecord[]): SleepSession | null {
  if (stages.length === 0) return null;

  const bedtime = stages[0]!.startDate;
  const wakeTime = stages[stages.length - 1]!.endDate;
  const date = sleepNightDate(wakeTime);

  const totals = { inBed: 0, core: 0, deep: 0, rem: 0, awake: 0 };
  for (const s of stages) {
    switch (s.stage) {
      case 'inBed': totals.inBed += s.durationMinutes; break;
      case 'asleepCore': totals.core += s.durationMinutes; break;
      case 'asleepDeep': totals.deep += s.durationMinutes; break;
      case 'asleepREM': totals.rem += s.durationMinutes; break;
      case 'awake': totals.awake += s.durationMinutes; break;
    }
  }

  const totalSleep = totals.core + totals.deep + totals.rem;
  const totalInBed = totalSleep + totals.awake + totals.inBed;
  const totalDuration = (wakeTime.getTime() - bedtime.getTime()) / 60000;

  // Skip very short "sessions" (< 60 min)
  if (totalDuration < 60) return null;

  const efficiency = totalInBed > 0 ? totalSleep / totalInBed : 0;
  const deepPercent = totalSleep > 0 ? totals.deep / totalSleep : 0;
  const remPercent = totalSleep > 0 ? totals.rem / totalSleep : 0;

  return {
    date,
    bedtime,
    wakeTime,
    totalDurationMinutes: totalDuration,
    stages: totals,
    efficiency,
    deepPercent,
    remPercent,
    records: stages,
  };
}

/**
 * Estimate resting HR from a day's HR data.
 * Uses the 10th percentile of sedentary readings (motionContext === 1).
 * Falls back to 10th percentile of all readings if no sedentary data.
 */
function estimateRestingHR(hrReadings: HRRecord[]): number | null {
  if (hrReadings.length === 0) return null;

  // Prefer sedentary readings
  let readings = hrReadings.filter(r => r.motionContext === 1);
  if (readings.length < 5) readings = hrReadings;

  const sorted = readings.map(r => r.bpm).sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.10);
  return sorted[idx] ?? null;
}

/**
 * Organize all extracted data into per-day buckets.
 */
export function organizeDailyData(extracted: ExtractedHealthData): Map<string, DailyHealthData> {
  const days = new Map<string, DailyHealthData>();

  function getDay(date: string): DailyHealthData {
    let day = days.get(date);
    if (!day) {
      day = {
        date,
        sleep: null,
        hrvReadings: [],
        hrReadings: [],
        restingHR: null,
        appleRestingHR: null,
        totalSteps: 0,
        exerciseMinutes: 0,
        spo2Readings: [],
        respiratoryReadings: [],
        activitySummary: null,
        workouts: [],
        wristTemp: null,
        avgNoiseDb: null,
        daylightMinutes: 0,
        weather: null,
        distanceKm: 0,
        avgWalkingSpeed: null,
        flightsClimbed: 0,
        activeEnergyBurned: 0,
        vo2max: null,
        aqi: null,
        pm25: null,
        walkingHR: null,
        physicalEffortAvg: null,
        sleepTimezoneOffsetHours: null,
      };
      days.set(date, day);
    }
    return day;
  }

  // HR records
  for (const hr of extracted.heartRate) {
    const day = getDay(dateKey(hr.timestamp));
    day.hrReadings.push(hr);
  }

  // HRV records
  for (const hrv of extracted.hrv) {
    const day = getDay(dateKey(hrv.timestamp));
    day.hrvReadings.push(hrv);
  }

  // SpO2
  for (const spo2 of extracted.spo2) {
    const day = getDay(dateKey(spo2.timestamp));
    day.spo2Readings.push(spo2);
  }

  // Respiratory rate
  for (const rr of extracted.respiratoryRate) {
    const day = getDay(dateKey(rr.timestamp));
    day.respiratoryReadings.push(rr);
  }

  // Steps — deduplicate by source priority (Watch > Phone)
  // Apple Health exports contain overlapping step records from both devices.
  // Group by day, then by source. Use Watch data if available, else Phone.
  const stepsByDay = new Map<string, Map<string, number>>();
  for (const step of extracted.steps) {
    const dk = dateKey(step.startDate);
    if (!stepsByDay.has(dk)) stepsByDay.set(dk, new Map());
    const sources = stepsByDay.get(dk)!;
    const src = step.source.toLowerCase().includes('watch') ? 'watch' : 'phone';
    sources.set(src, (sources.get(src) ?? 0) + step.steps);
  }
  for (const [dk, sources] of stepsByDay) {
    const day = getDay(dk);
    // Prefer Watch steps, fall back to phone
    day.totalSteps = sources.get('watch') ?? sources.get('phone') ?? 0;
  }

  // Activity summaries
  for (const activity of extracted.activitySummaries) {
    const day = getDay(activity.date);
    day.activitySummary = activity;
    day.exerciseMinutes = activity.appleExerciseTime;
  }

  // Workouts — add to day but DON'T double-count exercise minutes
  // (appleExerciseTime from ActivitySummary already includes workout time)
  for (const workout of extracted.workouts) {
    const day = getDay(dateKey(workout.startDate));
    day.workouts.push(workout);
    // Only add workout exercise time if no ActivitySummary exists for this day
    if (!day.activitySummary) {
      day.exerciseMinutes += workout.durationMinutes;
    }
  }

  // Sleep sessions — group then assign to nights
  const sleepSessions = groupSleepSessions(extracted.sleepStages);
  for (const session of sleepSessions) {
    const day = getDay(session.date);
    // Keep the longest sleep session per night (main sleep, not naps)
    if (!day.sleep || session.totalDurationMinutes > day.sleep.totalDurationMinutes) {
      day.sleep = session;
    }
  }

  // Apple's computed resting HR
  for (const rhr of extracted.restingHR) {
    const day = getDay(dateKey(rhr.timestamp));
    day.appleRestingHR = rhr.bpm;
  }

  // Wrist temperature (sleeping)
  for (const wt of extracted.wristTemperature) {
    const day = getDay(dateKey(wt.timestamp));
    day.wristTemp = wt.temperatureC;
  }

  // Audio exposure — average per day
  const audioDays = new Map<string, number[]>();
  for (const ae of extracted.audioExposure) {
    const dk = dateKey(ae.timestamp);
    if (!audioDays.has(dk)) audioDays.set(dk, []);
    audioDays.get(dk)!.push(ae.dbLevel);
  }
  for (const [dk, levels] of audioDays) {
    const day = getDay(dk);
    day.avgNoiseDb = levels.reduce((s, v) => s + v, 0) / levels.length;
  }

  // Daylight minutes
  for (const dl of extracted.daylight) {
    const day = getDay(dateKey(dl.startDate));
    day.daylightMinutes += dl.minutes;
  }

  // Weather from workouts (use first outdoor workout of the day)
  for (const day of days.values()) {
    const outdoorWorkout = day.workouts.find(w => w.weather && !w.weather.indoor);
    if (outdoorWorkout?.weather) {
      day.weather = {
        temperatureF: outdoorWorkout.weather.temperatureF,
        humidity: outdoorWorkout.weather.humidity,
        source: 'workout',
      };
    }
  }

  // Distance — deduplicate like steps (Watch > Phone)
  const distByDay = new Map<string, Map<string, number>>();
  for (const d of extracted.distance) {
    const dk = dateKey(d.startDate);
    if (!distByDay.has(dk)) distByDay.set(dk, new Map());
    const sources = distByDay.get(dk)!;
    const src = d.source.toLowerCase().includes('watch') ? 'watch' : 'phone';
    sources.set(src, (sources.get(src) ?? 0) + d.km);
  }
  for (const [dk, sources] of distByDay) {
    getDay(dk).distanceKm = sources.get('watch') ?? sources.get('phone') ?? 0;
  }

  // Active energy — deduplicate like steps
  const energyByDay = new Map<string, Map<string, number>>();
  for (const e of extracted.activeEnergy) {
    const dk = dateKey(e.timestamp);
    if (!energyByDay.has(dk)) energyByDay.set(dk, new Map());
    const sources = energyByDay.get(dk)!;
    // No source on activeEnergy — just sum (ActivitySummary is authoritative if present)
    sources.set('all', (sources.get('all') ?? 0) + e.kcal);
  }
  for (const [dk, sources] of energyByDay) {
    const day = getDay(dk);
    if (!day.activitySummary) {
      day.activeEnergyBurned = sources.get('all') ?? 0;
    } else {
      day.activeEnergyBurned = day.activitySummary.activeEnergyBurned;
    }
  }

  // Flights climbed
  for (const f of extracted.flightsClimbed) {
    getDay(dateKey(f.timestamp)).flightsClimbed += f.flights;
  }

  // Walking speed — average per day
  const speedByDay = new Map<string, number[]>();
  for (const ws of extracted.walkingSpeed) {
    const dk = dateKey(ws.timestamp);
    if (!speedByDay.has(dk)) speedByDay.set(dk, []);
    speedByDay.get(dk)!.push(ws.kmPerHour);
  }
  for (const [dk, speeds] of speedByDay) {
    getDay(dk).avgWalkingSpeed = speeds.reduce((s, v) => s + v, 0) / speeds.length;
  }

  // VO2Max
  for (const v of extracted.vo2max) {
    getDay(dateKey(v.timestamp)).vo2max = v.value;
  }

  // Walking HR — daily average (for WHAS in CASS)
  const walkingHRByDay = new Map<string, number[]>();
  for (const whr of extracted.walkingHR) {
    const dk = dateKey(whr.timestamp);
    if (!walkingHRByDay.has(dk)) walkingHRByDay.set(dk, []);
    walkingHRByDay.get(dk)!.push(whr.bpm);
  }
  for (const [dk, values] of walkingHRByDay) {
    getDay(dk).walkingHR = values.reduce((s, v) => s + v, 0) / values.length;
  }

  // Physical effort — daily average (kcal/hr·kg, for PES in ILAS)
  const peByDay = new Map<string, number[]>();
  for (const pe of extracted.physicalEffort) {
    const dk = dateKey(pe.timestamp);
    if (!peByDay.has(dk)) peByDay.set(dk, []);
    peByDay.get(dk)!.push(pe.value);
  }
  for (const [dk, values] of peByDay) {
    getDay(dk).physicalEffortAvg = values.reduce((s, v) => s + v, 0) / values.length;
  }

  // Sleep timezone offset — from sleep stage records (for CDP in ILAS)
  // Use the most common non-null timezone offset found in the day's sleep stages.
  const tzByDay = new Map<string, number[]>();
  for (const ss of extracted.sleepStages) {
    if (ss.timezoneOffsetHours !== null) {
      const dk = dateKey(ss.startDate);
      if (!tzByDay.has(dk)) tzByDay.set(dk, []);
      tzByDay.get(dk)!.push(ss.timezoneOffsetHours);
    }
  }
  for (const [dk, offsets] of tzByDay) {
    // Use modal (most common) offset for robustness against brief DST records
    const freq = new Map<number, number>();
    for (const o of offsets) freq.set(o, (freq.get(o) ?? 0) + 1);
    const modal = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    getDay(dk).sleepTimezoneOffsetHours = modal;
  }

  // Compute resting HR for each day (our estimate, prefer Apple's if available)
  for (const day of days.values()) {
    day.restingHR = day.appleRestingHR ?? estimateRestingHR(day.hrReadings);
  }

  return days;
}

/** Get sorted date keys */
export function getSortedDates(days: Map<string, DailyHealthData>): string[] {
  return [...days.keys()].sort();
}
