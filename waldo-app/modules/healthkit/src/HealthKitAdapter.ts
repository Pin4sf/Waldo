/**
 * HealthKit implementation of the HealthDataSource adapter interface.
 *
 * This adapter bridges the raw native module output to the typed
 * HealthDataSource interface used by the CRS engine and agent logic.
 *
 * Platform: iOS only (.ios.ts file extension enforces this at the bundler level)
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
  queryHRV,
  queryHeartRate,
  queryRestingHeartRate,
  querySleep,
  querySteps,
  querySpO2,
  queryRespiratoryRate,
  requestPermissions as nativeRequestPermissions,
  getPermissionStatus as nativeGetPermissionStatus,
  enableBackgroundDelivery as nativeEnableBackgroundDelivery,
  addHealthDataListener,
  isHealthKitAvailable,
} from './HealthKitModule';

export class HealthKitAdapter implements HealthDataSource {
  readonly platform = 'ios' as const;

  /**
   * HRV source is determined dynamically based on what HealthKit returns.
   * Starts as 'none', updated after first successful HRV query.
   * This is the value the CRS engine uses to choose the computation path.
   */
  private _deviceHrvSource: DeviceHrvSourceType = 'none';

  get deviceHrvSource(): DeviceHrvSourceType {
    return this._deviceHrvSource;
  }

  async requestPermissions(): Promise<PermissionResult> {
    if (!isHealthKitAvailable()) {
      return {
        overall: 'restricted',
        byType: this.emptyByType('restricted'),
        deniedTypes: [],
      };
    }
    const result = await nativeRequestPermissions();
    return this.mapPermissionResult(result);
  }

  async getPermissionStatus(): Promise<PermissionResult> {
    if (!isHealthKitAvailable()) {
      return {
        overall: 'restricted',
        byType: this.emptyByType('restricted'),
        deniedTypes: [],
      };
    }
    const result = await nativeGetPermissionStatus();
    return this.mapPermissionResult(result);
  }

  async queryHRV(range: DateRange): Promise<AdapterResult<HRVRecord[]>> {
    try {
      const raw = await queryHRV(range.startDate.getTime(), range.endDate.getTime());
      if (raw.length === 0) {
        return { ok: true, data: [] };
      }

      // Update the adapter's HRV source based on what the native module returned
      // Use the most accurate source seen across all samples
      const hasIBI = raw.some(r => r.deviceHrvSource === 'healthkit_ibi');
      this._deviceHrvSource = hasIBI ? 'healthkit_ibi' : 'healthkit_sdnn';

      const records: HRVRecord[] = raw.map(r => ({
        timestamp: new Date(r.timestamp),
        sdnn: r.sdnn,
        beats: [], // Raw beats not surfaced to JS — RMSSD computed natively
        rmssd: r.rmssd ?? null,
        source: `healthkit_${r.deviceHrvSource}`,
      }));

      return { ok: true, data: records };
    } catch (err) {
      return { ok: false, error: String(err), code: 'API_UNAVAILABLE' };
    }
  }

  async queryHeartRate(range: DateRange): Promise<AdapterResult<HRRecord[]>> {
    try {
      const raw = await queryHeartRate(range.startDate.getTime(), range.endDate.getTime());
      const records: HRRecord[] = raw.map(r => ({
        timestamp: new Date(r.timestamp),
        bpm: r.bpm,
        motionContext: r.motionContext as 0 | 1 | 2,
        source: r.source,
      }));
      return { ok: true, data: records };
    } catch (err) {
      return { ok: false, error: String(err), code: 'API_UNAVAILABLE' };
    }
  }

  async queryRestingHeartRate(range: DateRange): Promise<AdapterResult<RestingHRRecord[]>> {
    try {
      const raw = await queryRestingHeartRate(range.startDate.getTime(), range.endDate.getTime());
      const records: RestingHRRecord[] = raw.map(r => ({
        timestamp: new Date(r.timestamp),
        bpm: r.bpm,
        source: r.source,
      }));
      return { ok: true, data: records };
    } catch (err) {
      return { ok: false, error: String(err), code: 'API_UNAVAILABLE' };
    }
  }

  async querySleep(range: DateRange): Promise<AdapterResult<SleepStageRecord[]>> {
    try {
      const raw = await querySleep(range.startDate.getTime(), range.endDate.getTime());
      const records: SleepStageRecord[] = raw.map(r => ({
        stage: r.stage as SleepStage,
        startDate: new Date(r.startMs),
        endDate: new Date(r.endMs),
        durationMinutes: r.durationMinutes,
        source: r.source,
      }));
      return { ok: true, data: records };
    } catch (err) {
      return { ok: false, error: String(err), code: 'API_UNAVAILABLE' };
    }
  }

  async querySteps(range: DateRange): Promise<AdapterResult<StepRecord[]>> {
    try {
      const raw = await querySteps(range.startDate.getTime(), range.endDate.getTime());
      const record: StepRecord = {
        startDate: new Date(raw.startMs),
        endDate: new Date(raw.endMs),
        steps: raw.totalSteps,
        source: raw.source,
      };
      return { ok: true, data: [record] };
    } catch (err) {
      return { ok: false, error: String(err), code: 'API_UNAVAILABLE' };
    }
  }

  async querySpO2(range: DateRange): Promise<AdapterResult<SpO2Record[]>> {
    try {
      const raw = await querySpO2(range.startDate.getTime(), range.endDate.getTime());
      const records: SpO2Record[] = raw.map(r => ({
        timestamp: new Date(r.timestamp),
        percentage: r.percentage,
        source: r.source,
      }));
      return { ok: true, data: records };
    } catch (err) {
      return { ok: false, error: String(err), code: 'API_UNAVAILABLE' };
    }
  }

  async queryRespiratoryRate(range: DateRange): Promise<AdapterResult<RespiratoryRateRecord[]>> {
    try {
      const raw = await queryRespiratoryRate(range.startDate.getTime(), range.endDate.getTime());
      const records: RespiratoryRateRecord[] = raw.map(r => ({
        timestamp: new Date(r.timestamp),
        breathsPerMinute: r.breathsPerMinute,
        source: r.source,
      }));
      return { ok: true, data: records };
    } catch (err) {
      return { ok: false, error: String(err), code: 'API_UNAVAILABLE' };
    }
  }

  async enableBackgroundDelivery(types: HealthDataType[]): Promise<void> {
    // types parameter is informational — native module registers all supported types
    await nativeEnableBackgroundDelivery();
  }

  onNewData(callback: (type: HealthDataType) => void): () => void {
    const sub = addHealthDataListener((typeStr) => {
      // Validate the type string before passing to core logic
      const validTypes: HealthDataType[] = [
        'hrv', 'heart_rate', 'resting_heart_rate', 'sleep',
        'steps', 'spo2', 'respiratory_rate',
      ];
      if (validTypes.includes(typeStr as HealthDataType)) {
        callback(typeStr as HealthDataType);
      }
    });
    return () => sub.remove();
  }

  // MARK: - Private

  private mapPermissionResult(raw: {
    overall: string;
    byType: Record<string, string>;
    deniedTypes: string[];
  }): PermissionResult {
    const ALL_TYPES: HealthDataType[] = [
      'hrv', 'heart_rate', 'resting_heart_rate', 'sleep',
      'steps', 'spo2', 'respiratory_rate',
    ];

    const byType = {} as Record<HealthDataType, 'granted' | 'denied' | 'not_determined' | 'restricted'>;
    for (const type of ALL_TYPES) {
      const status = raw.byType[type] ?? 'not_determined';
      byType[type] = status as 'granted' | 'denied' | 'not_determined' | 'restricted';
    }

    return {
      overall: raw.overall as 'granted' | 'denied' | 'not_determined' | 'restricted',
      byType,
      deniedTypes: raw.deniedTypes as HealthDataType[],
    };
  }

  private emptyByType(
    status: 'granted' | 'denied' | 'not_determined' | 'restricted'
  ): Record<HealthDataType, typeof status> {
    const ALL_TYPES: HealthDataType[] = [
      'hrv', 'heart_rate', 'resting_heart_rate', 'sleep',
      'steps', 'spo2', 'respiratory_rate',
    ];
    return Object.fromEntries(ALL_TYPES.map(t => [t, status])) as Record<HealthDataType, typeof status>;
  }
}
