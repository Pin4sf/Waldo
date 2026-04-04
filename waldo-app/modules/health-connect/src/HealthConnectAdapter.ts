/**
 * HealthConnect implementation of the HealthDataSource adapter interface.
 * Android only. iOS uses HealthKitAdapter via modules/healthkit/src/HealthKitAdapter.ts.
 *
 * Bridges raw native module output to the typed HealthDataSource interface
 * used by the CRS engine.
 *
 * Key behaviour:
 * - Samsung / watches without RMSSD in Health Connect → HR-variance proxy HRV
 * - Any query failure returns empty AdapterResult (never throws)
 * - Background delivery: uses expo-background-fetch (WorkManager under the hood)
 */
import type {
  HealthDataSource,
  HealthDataType,
  PermissionResult,
  AdapterResult,
  DeviceHrvSourceType,
} from '@/types/adapters';
import type {
  HRVRecord,
  HRRecord,
  RestingHRRecord,
  SleepStageRecord,
  StepRecord,
  SpO2Record,
  RespiratoryRateRecord,
  DateRange,
  SleepStage,
} from '@/types/health';
import {
  isAvailable,
  hasPermissions,
  readHeartRate,
  readHRV,
  readSleep,
  readSteps,
  readSpO2,
  readRestingHR,
  readExercise,
} from './HealthConnectModule';

/** Format a Date as 'YYYY-MM-DD' in local time */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Simple event emitter for background delivery callbacks */
type NewDataCallback = (type: HealthDataType) => void;
const listeners: Set<NewDataCallback> = new Set();

export class HealthConnectAdapter implements HealthDataSource {
  readonly platform = 'android' as const;

  private _deviceHrvSource: DeviceHrvSourceType = 'none';

  get deviceHrvSource(): DeviceHrvSourceType {
    return this._deviceHrvSource;
  }

  async requestPermissions(): Promise<PermissionResult> {
    if (!isAvailable()) {
      return this.unavailablePermission();
    }
    // Health Connect permissions must be granted via system activity.
    // The native module returns currently-granted permissions.
    // The app's OnboardingScreen launches the HC permission activity separately.
    const granted = await hasPermissions();
    return {
      overall: granted ? 'granted' : 'not_determined',
      byType: this.allByType(granted ? 'granted' : 'not_determined'),
      deniedTypes: [],
    };
  }

  async getPermissionStatus(): Promise<PermissionResult> {
    if (!isAvailable()) return this.unavailablePermission();
    const granted = await hasPermissions();
    return {
      overall: granted ? 'granted' : 'not_determined',
      byType: this.allByType(granted ? 'granted' : 'not_determined'),
      deniedTypes: [],
    };
  }

  async queryHRV(range: DateRange): Promise<AdapterResult<HRVRecord[]>> {
    if (!isAvailable()) return { ok: false, error: 'Health Connect unavailable', code: 'API_UNAVAILABLE' };
    try {
      const dateStr = toDateStr(range.startDate);
      const raw = await readHRV(dateStr);
      if (raw.source === 'mock' || raw.readingCount === 0) {
        return { ok: true, data: [] };
      }

      // Update HRV source tracking
      this._deviceHrvSource = raw.isSamsungProxy ? 'hr_proxy' : 'health_connect_rmssd';

      const record: HRVRecord = {
        timestamp: new Date(),
        sdnn: raw.rmssd * 0.75, // Approximate SDNN from RMSSD (population average ratio)
        beats: [],
        rmssd: raw.rmssd,
        source: raw.source,
      };
      return { ok: true, data: [record] };
    } catch (err) {
      return { ok: false, error: String(err), code: 'UNKNOWN' };
    }
  }

  async queryHeartRate(range: DateRange): Promise<AdapterResult<HRRecord[]>> {
    if (!isAvailable()) return { ok: false, error: 'Health Connect unavailable', code: 'API_UNAVAILABLE' };
    try {
      const dateStr = toDateStr(range.startDate);
      const raw = await readHeartRate(dateStr);
      if (raw.source === 'mock' || raw.sampleCount === 0) {
        return { ok: true, data: [] };
      }
      const record: HRRecord = {
        timestamp: new Date(),
        bpm: raw.avgHR,
        motionContext: 1, // HC doesn't provide motion context — treat as sedentary
        source: 'health_connect',
      };
      return { ok: true, data: [record] };
    } catch (err) {
      return { ok: false, error: String(err), code: 'UNKNOWN' };
    }
  }

  async queryRestingHeartRate(range: DateRange): Promise<AdapterResult<RestingHRRecord[]>> {
    if (!isAvailable()) return { ok: false, error: 'Health Connect unavailable', code: 'API_UNAVAILABLE' };
    try {
      const dateStr = toDateStr(range.startDate);

      // Try direct resting HR record first
      const direct = await readRestingHR(dateStr);
      if (direct.bpm !== null) {
        return {
          ok: true,
          data: [{ timestamp: new Date(), bpm: direct.bpm, source: 'health_connect' }],
        };
      }

      // Fall back to HR adapter's resting estimate
      const hr = await readHeartRate(dateStr);
      if (hr.restingHR > 0) {
        return {
          ok: true,
          data: [{ timestamp: new Date(), bpm: hr.restingHR, source: 'health_connect_estimate' }],
        };
      }

      return { ok: true, data: [] };
    } catch (err) {
      return { ok: false, error: String(err), code: 'UNKNOWN' };
    }
  }

  async querySleep(range: DateRange): Promise<AdapterResult<SleepStageRecord[]>> {
    if (!isAvailable()) return { ok: false, error: 'Health Connect unavailable', code: 'API_UNAVAILABLE' };
    try {
      const dateStr = toDateStr(range.endDate); // End date of sleep range = morning
      const raw = await readSleep(dateStr);
      if (raw.source === 'mock' || raw.durationHours === 0) {
        return { ok: true, data: [] };
      }

      const records: SleepStageRecord[] = [];
      const startTime = new Date(raw.startTime);
      const endTime   = new Date(raw.endTime);

      if (raw.stages) {
        const { deep, rem, light, awake } = raw.stages;
        // Build synthetic stage records from aggregated totals
        const push = (stage: SleepStage, minutes: number) => {
          if (minutes <= 0) return;
          records.push({
            stage,
            startDate: startTime,
            endDate: endTime,
            durationMinutes: minutes,
            source: 'health_connect',
          });
        };
        push('asleepDeep', deep);
        push('asleepREM', rem);
        push('asleepCore', light);
        push('awake', awake);
      } else {
        // No stage breakdown — report as core sleep
        records.push({
          stage: 'asleepCore',
          startDate: startTime,
          endDate: endTime,
          durationMinutes: raw.durationHours * 60,
          source: 'health_connect',
        });
      }

      return { ok: true, data: records };
    } catch (err) {
      return { ok: false, error: String(err), code: 'UNKNOWN' };
    }
  }

  async querySteps(range: DateRange): Promise<AdapterResult<StepRecord[]>> {
    if (!isAvailable()) return { ok: false, error: 'Health Connect unavailable', code: 'API_UNAVAILABLE' };
    try {
      const dateStr = toDateStr(range.startDate);
      const raw = await readSteps(dateStr);
      if (raw.source === 'error' || raw.steps === 0) {
        return { ok: true, data: [] };
      }
      const record: StepRecord = {
        startDate: range.startDate,
        endDate: range.endDate,
        steps: raw.steps,
        source: 'health_connect',
      };
      return { ok: true, data: [record] };
    } catch (err) {
      return { ok: false, error: String(err), code: 'UNKNOWN' };
    }
  }

  async querySpO2(range: DateRange): Promise<AdapterResult<SpO2Record[]>> {
    if (!isAvailable()) return { ok: false, error: 'Health Connect unavailable', code: 'API_UNAVAILABLE' };
    try {
      const dateStr = toDateStr(range.startDate);
      const raw = await readSpO2(dateStr);
      if (raw.avgPct === null || raw.count === 0) {
        return { ok: true, data: [] };
      }
      return {
        ok: true,
        data: [{ timestamp: new Date(), percentage: raw.avgPct, source: 'health_connect' }],
      };
    } catch (err) {
      return { ok: false, error: String(err), code: 'UNKNOWN' };
    }
  }

  async queryRespiratoryRate(_range: DateRange): Promise<AdapterResult<RespiratoryRateRecord[]>> {
    // Health Connect has RespiratoryRateRecord but most watches don't write it
    return { ok: true, data: [] };
  }

  async enableBackgroundDelivery(types: HealthDataType[]): Promise<void> {
    // Android background delivery via WorkManager is set up in the native layer.
    // The Kotlin WorkManager task reads all HC data types registered here.
    // This is a no-op on the JS side — background tasks are registered in the
    // app's MainActivity or via expo-background-fetch configuration.
    if (__DEV__) {
      console.log('[HealthConnectAdapter] Background delivery types:', types.join(', '));
    }
  }

  onNewData(callback: NewDataCallback): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private unavailablePermission(): PermissionResult {
    return {
      overall: 'restricted',
      byType: this.allByType('restricted'),
      deniedTypes: [],
    };
  }

  private allByType(status: PermissionResult['overall']): PermissionResult['byType'] {
    const types: HealthDataType[] = [
      'hrv', 'heart_rate', 'resting_heart_rate', 'sleep', 'steps', 'spo2', 'respiratory_rate',
    ];
    return Object.fromEntries(types.map(t => [t, status])) as PermissionResult['byType'];
  }
}

/** Called by WorkManager background task when new health data arrives */
export function notifyNewData(type: HealthDataType): void {
  listeners.forEach(cb => cb(type));
}
