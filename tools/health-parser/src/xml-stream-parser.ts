/**
 * Streaming XML parser for Apple Health exports.
 * Uses saxes to process 289MB+ files without loading into memory.
 *
 * Extracts: HR, HRV (with raw beats), sleep stages, SpO2, respiratory rate,
 * steps, activity summaries, workouts, and user profile.
 */
import { SaxesParser } from 'saxes';
import * as fs from 'node:fs';
import type {
  ExtractedHealthData,
  InstantaneousBeat,
  SleepStage,
} from './types/index.js';

/** Record types we care about */
const RECORD_TYPES = {
  HR: 'HKQuantityTypeIdentifierHeartRate',
  HRV: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  SLEEP: 'HKCategoryTypeIdentifierSleepAnalysis',
  SPO2: 'HKQuantityTypeIdentifierOxygenSaturation',
  RESPIRATORY: 'HKQuantityTypeIdentifierRespiratoryRate',
  STEPS: 'HKQuantityTypeIdentifierStepCount',
  RESTING_HR: 'HKQuantityTypeIdentifierRestingHeartRate',
  WRIST_TEMP: 'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  AUDIO_EXPOSURE: 'HKQuantityTypeIdentifierEnvironmentalAudioExposure',
  DAYLIGHT: 'HKQuantityTypeIdentifierTimeInDaylight',
  DISTANCE: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  ACTIVE_ENERGY: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  FLIGHTS: 'HKQuantityTypeIdentifierFlightsClimbed',
  WALKING_SPEED: 'HKQuantityTypeIdentifierWalkingSpeed',
  VO2MAX: 'HKQuantityTypeIdentifierVO2Max',
} as const;

/** Map Apple sleep stage values to our types */
const SLEEP_STAGE_MAP: Record<string, SleepStage> = {
  HKCategoryValueSleepAnalysisInBed: 'inBed',
  HKCategoryValueSleepAnalysisAsleepCore: 'asleepCore',
  HKCategoryValueSleepAnalysisAsleepDeep: 'asleepDeep',
  HKCategoryValueSleepAnalysisAsleepREM: 'asleepREM',
  HKCategoryValueSleepAnalysisAwake: 'awake',
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'asleepCore',
};

/** Parse Apple Health date string → Date */
function parseDate(dateStr: string): Date {
  // Format: "2025-10-21 20:03:44 +0530"
  return new Date(dateStr.replace(' ', 'T').replace(' ', ''));
}

/** Compute RMSSD from instantaneous BPM beats */
function computeRmssd(beats: InstantaneousBeat[]): number | null {
  if (beats.length < 3) return null;

  // Convert BPM to IBI (inter-beat interval) in ms
  const ibis = beats.map(b => 60000 / b.bpm);

  // Filter physiologically impossible values (300-2000ms range)
  const validIbis = ibis.filter(ibi => ibi >= 300 && ibi <= 2000);
  if (validIbis.length < 3) return null;

  // Check artifact ratio — if >20% invalid, discard
  if ((ibis.length - validIbis.length) / ibis.length > 0.20) return null;

  // Compute successive differences
  let sumSquaredDiffs = 0;
  let count = 0;
  for (let i = 1; i < validIbis.length; i++) {
    const diff = validIbis[i]! - validIbis[i - 1]!;
    sumSquaredDiffs += diff * diff;
    count++;
  }

  if (count === 0) return null;
  return Math.sqrt(sumSquaredDiffs / count);
}

interface ParseProgress {
  recordsProcessed: number;
  bytesRead: number;
  totalBytes: number;
}

type ProgressCallback = (progress: ParseProgress) => void;

export async function parseAppleHealthExport(
  filePath: string,
  onProgress?: ProgressCallback,
): Promise<ExtractedHealthData> {
  const stats = fs.statSync(filePath);
  const totalBytes = stats.size;

  const data: ExtractedHealthData = {
    profile: { dateOfBirth: '', biologicalSex: '', age: 0 },
    heartRate: [],
    hrv: [],
    sleepStages: [],
    spo2: [],
    respiratoryRate: [],
    activitySummaries: [],
    steps: [],
    workouts: [],
    wristTemperature: [],
    restingHR: [],
    audioExposure: [],
    daylight: [],
    distance: [],
    walkingSpeed: [],
    activeEnergy: [],
    flightsClimbed: [],
    vo2max: [],
    exportDate: new Date(),
    recordCount: 0,
  };

  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });

    // State tracking for nested elements
    let currentRecordType = '';
    let currentRecordAttrs: Record<string, string> = {};
    let insideRecord = false;
    let insideHRVMetadata = false;
    let currentBeats: InstantaneousBeat[] = [];
    let currentMotionContext: 0 | 1 | 2 = 0;
    let bytesRead = 0;
    let recordsProcessed = 0;

    // Inside a Workout element
    let insideWorkout = false;
    let currentWorkoutAttrs: Record<string, string> = {};
    let currentWorkoutMeta: Record<string, string> = {};

    parser.on('opentag', (tag) => {
      const attrs = tag.attributes as Record<string, string>;

      switch (tag.name) {
        case 'ExportDate':
          data.exportDate = parseDate(attrs['value'] ?? '');
          break;

        case 'Me':
          data.profile = {
            dateOfBirth: attrs['HKCharacteristicTypeIdentifierDateOfBirth'] ?? '',
            biologicalSex: (attrs['HKCharacteristicTypeIdentifierBiologicalSex'] ?? '').replace('HKBiologicalSex', ''),
            age: 0,
          };
          if (data.profile.dateOfBirth) {
            const dob = new Date(data.profile.dateOfBirth);
            data.profile.age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          }
          break;

        case 'Record': {
          const type = attrs['type'] ?? '';
          insideRecord = true;
          currentRecordType = type;
          currentRecordAttrs = attrs;
          currentBeats = [];
          currentMotionContext = 0;
          break;
        }

        case 'HeartRateVariabilityMetadataList':
          insideHRVMetadata = true;
          break;

        case 'InstantaneousBeatsPerMinute':
          if (insideHRVMetadata) {
            currentBeats.push({
              bpm: Number(attrs['bpm'] ?? 0),
              timeStr: attrs['time'] ?? '',
            });
          }
          break;

        case 'MetadataEntry':
          if (insideRecord && attrs['key'] === 'HKMetadataKeyHeartRateMotionContext') {
            currentMotionContext = Number(attrs['value'] ?? 0) as 0 | 1 | 2;
          }
          if (insideWorkout) {
            const key = attrs['key'] ?? '';
            const val = attrs['value'] ?? '';
            if (key === 'HKWeatherTemperature' || key === 'HKWeatherHumidity' || key === 'HKIndoorWorkout' || key === 'HKAverageMETs') {
              currentWorkoutMeta[key] = val;
            }
          }
          break;

        case 'ActivitySummary':
          data.activitySummaries.push({
            date: attrs['dateComponents'] ?? '',
            activeEnergyBurned: Number(attrs['activeEnergyBurned'] ?? 0),
            appleMoveTime: Number(attrs['appleMoveTime'] ?? 0),
            appleExerciseTime: Number(attrs['appleExerciseTime'] ?? 0),
            appleStandHours: Number(attrs['appleStandHours'] ?? 0),
          });
          break;

        case 'Workout':
          insideWorkout = true;
          currentWorkoutAttrs = attrs;
          currentWorkoutMeta = {};
          break;
      }
    });

    parser.on('closetag', (tag) => {
      const name = tag.name;
      if (name === 'HeartRateVariabilityMetadataList') {
        insideHRVMetadata = false;
      }

      if (name === 'Record' && insideRecord) {
        processRecord(data, currentRecordType, currentRecordAttrs, currentBeats, currentMotionContext);
        insideRecord = false;
        currentRecordType = '';
        currentRecordAttrs = {};
        currentBeats = [];
        currentMotionContext = 0;
        recordsProcessed++;
      }

      if (name === 'Workout' && insideWorkout) {
        const wa = currentWorkoutAttrs;
        const wm = currentWorkoutMeta;
        const tempStr = wm['HKWeatherTemperature'];
        const humStr = wm['HKWeatherHumidity'];
        const weather = tempStr ? {
          temperatureF: parseFloat(tempStr),
          humidity: humStr ? parseFloat(humStr) / 100 : 0, // Apple stores as 6900 = 69%
          indoor: wm['HKIndoorWorkout'] === '1',
        } : undefined;
        const metsStr = wm['HKAverageMETs'];
        data.workouts.push({
          activityType: (wa['workoutActivityType'] ?? '').replace('HKWorkoutActivityType', ''),
          startDate: parseDate(wa['startDate'] ?? ''),
          endDate: parseDate(wa['endDate'] ?? ''),
          durationMinutes: Number(wa['duration'] ?? 0),
          totalEnergyBurned: Number(wa['totalEnergyBurned'] ?? 0),
          totalDistance: Number(wa['totalDistance'] ?? 0),
          source: wa['sourceName'] ?? '',
          weather,
          avgMETs: metsStr ? parseFloat(metsStr) : undefined,
        });
        insideWorkout = false;
        currentWorkoutAttrs = {};
        currentWorkoutMeta = {};
      }
    });

    parser.on('error', (err) => {
      reject(new Error(`XML parse error: ${err.message}`));
    });

    stream.on('data', (chunk) => {
      const str = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      bytesRead += Buffer.byteLength(str, 'utf-8');
      parser.write(str);

      if (onProgress && recordsProcessed % 10000 === 0) {
        onProgress({ recordsProcessed, bytesRead, totalBytes });
      }
    });

    stream.on('end', () => {
      parser.close();
      data.recordCount = recordsProcessed;
      resolve(data);
    });

    stream.on('error', (err) => {
      reject(new Error(`File read error: ${err.message}`));
    });
  });
}

function processRecord(
  data: ExtractedHealthData,
  type: string,
  attrs: Record<string, string>,
  beats: InstantaneousBeat[],
  motionContext: 0 | 1 | 2,
): void {
  const startDate = parseDate(attrs['startDate'] ?? '');
  const endDate = parseDate(attrs['endDate'] ?? '');
  const value = Number(attrs['value'] ?? 0);
  const source = attrs['sourceName'] ?? '';

  switch (type) {
    case RECORD_TYPES.HR:
      data.heartRate.push({
        timestamp: startDate,
        bpm: value,
        motionContext,
        source,
      });
      break;

    case RECORD_TYPES.HRV: {
      const rmssd = computeRmssd(beats);
      data.hrv.push({
        timestamp: startDate,
        sdnn: value,
        beats,
        rmssd,
        source,
      });
      break;
    }

    case RECORD_TYPES.SLEEP: {
      const stageValue = attrs['value'] ?? '';
      const stage = SLEEP_STAGE_MAP[stageValue];
      if (stage) {
        const durationMs = endDate.getTime() - startDate.getTime();
        data.sleepStages.push({
          stage,
          startDate,
          endDate,
          durationMinutes: durationMs / 60000,
          source,
        });
      }
      break;
    }

    case RECORD_TYPES.SPO2:
      data.spo2.push({
        timestamp: startDate,
        percentage: value * 100, // Apple stores as 0-1 fraction
        source,
      });
      break;

    case RECORD_TYPES.RESPIRATORY:
      data.respiratoryRate.push({
        timestamp: startDate,
        breathsPerMinute: value,
        source,
      });
      break;

    case RECORD_TYPES.STEPS:
      data.steps.push({
        startDate,
        endDate,
        steps: value,
        source,
      });
      break;

    case RECORD_TYPES.RESTING_HR:
      data.restingHR.push({
        timestamp: startDate,
        bpm: value,
        source,
      });
      break;

    case RECORD_TYPES.WRIST_TEMP:
      data.wristTemperature.push({
        timestamp: startDate,
        temperatureC: value,
        source,
      });
      break;

    case RECORD_TYPES.AUDIO_EXPOSURE:
      data.audioExposure.push({
        timestamp: startDate,
        dbLevel: value,
        source,
      });
      break;

    case RECORD_TYPES.DAYLIGHT:
      data.daylight.push({
        startDate,
        endDate,
        minutes: value,
        source,
      });
      break;

    case RECORD_TYPES.DISTANCE:
      data.distance.push({ startDate, endDate, km: value, source });
      break;

    case RECORD_TYPES.ACTIVE_ENERGY:
      data.activeEnergy.push({ timestamp: startDate, kcal: value });
      break;

    case RECORD_TYPES.FLIGHTS:
      data.flightsClimbed.push({ timestamp: startDate, flights: value });
      break;

    case RECORD_TYPES.WALKING_SPEED:
      data.walkingSpeed.push({ timestamp: startDate, kmPerHour: value, source });
      break;

    case RECORD_TYPES.VO2MAX:
      data.vo2max.push({ timestamp: startDate, value });
      break;
  }
}
