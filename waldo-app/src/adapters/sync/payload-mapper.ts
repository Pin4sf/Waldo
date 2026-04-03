/**
 * Maps local DailyHealthData + CrsResult → Supabase row shapes.
 *
 * Column names match the existing migration:
 * supabase/migrations/20260331000001_waldo_demo_schema.sql
 *
 * Security: this function produces the payload sent to Supabase.
 * NEVER include raw health values in any log statement — only
 * log the date and event type.
 */

import type { LocalSnapshot } from '@/types/adapters';
import type { CrsResult } from '@/crs/types';

/** Row shape for health_snapshots upsert */
export interface HealthSnapshotRow {
  user_id: string;
  date: string;
  hr_avg: number | null;
  hr_min: number | null;
  hr_max: number | null;
  hr_count: number;
  hrv_rmssd: number | null;
  hrv_sdnn: number | null;
  hrv_count: number;
  resting_hr: number | null;
  sleep_duration_hours: number | null;
  sleep_efficiency: number | null;
  sleep_deep_pct: number | null;
  sleep_rem_pct: number | null;
  sleep_bedtime: string | null;
  sleep_wake_time: string | null;
  sleep_stages: unknown | null;
  steps: number;
  exercise_minutes: number;
  active_energy: number | null;
  distance_km: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  wrist_temp: number | null;
  vo2max: number | null;
  weather: unknown | null;
  aqi: number | null;
  pm25: number | null;
  daylight_minutes: number | null;
  data_tier: 'rich' | 'partial' | 'sparse' | 'empty';
  platform: string;
  device_hrv_source: string;
}

/** Row shape for crs_scores upsert */
export interface CrsScoreRow {
  user_id: string;
  date: string;
  score: number;
  zone: string;
  confidence: number | null;
  components_with_data: number | null;
  sleep_json: unknown | null;
  hrv_json: unknown | null;
  circadian_json: unknown | null;
  activity_json: unknown | null;
  summary: string | null;
}

export function mapToHealthSnapshotRow(
  snapshot: LocalSnapshot,
  userId: string,
  deviceHrvSource: string = 'healthkit_sdnn',
): HealthSnapshotRow {
  const d = snapshot.data;
  const hrBpms = d.hrReadings.map(r => r.bpm);
  const rmssdValues = d.hrvReadings.map(r => r.rmssd).filter((v): v is number => v !== null);
  const sdnnValues = d.hrvReadings.map(r => r.sdnn);

  // Data tier: how complete is this snapshot?
  const hasHrv = d.hrvReadings.length > 0;
  const hasSleep = d.sleep !== null;
  const hasHr = d.hrReadings.length > 0;
  const dataTier: HealthSnapshotRow['data_tier'] =
    hasHrv && hasSleep && hasHr ? 'rich'
    : (hasHrv || hasSleep) && hasHr ? 'partial'
    : hasHr ? 'sparse'
    : 'empty';

  return {
    user_id: userId,
    date: snapshot.date,
    hr_avg: hrBpms.length > 0 ? hrBpms.reduce((s, v) => s + v, 0) / hrBpms.length : null,
    hr_min: hrBpms.length > 0 ? Math.min(...hrBpms) : null,
    hr_max: hrBpms.length > 0 ? Math.max(...hrBpms) : null,
    hr_count: hrBpms.length,
    hrv_rmssd: rmssdValues.length > 0 ? rmssdValues.reduce((s, v) => s + v, 0) / rmssdValues.length : null,
    hrv_sdnn: sdnnValues.length > 0 ? sdnnValues.reduce((s, v) => s + v, 0) / sdnnValues.length : null,
    hrv_count: d.hrvReadings.length,
    resting_hr: d.restingHR ?? d.appleRestingHR,
    sleep_duration_hours: d.sleep ? d.sleep.totalDurationMinutes / 60 : null,
    sleep_efficiency: d.sleep?.efficiency ?? null,
    sleep_deep_pct: d.sleep?.deepPercent ?? null,
    sleep_rem_pct: d.sleep?.remPercent ?? null,
    sleep_bedtime: d.sleep?.bedtime.toISOString() ?? null,
    sleep_wake_time: d.sleep?.wakeTime.toISOString() ?? null,
    sleep_stages: d.sleep?.stages ?? null,
    steps: d.totalSteps,
    exercise_minutes: d.exerciseMinutes,
    active_energy: d.activeEnergyBurned || null,
    distance_km: d.distanceKm || null,
    spo2: d.spo2Readings.length > 0
      ? d.spo2Readings.reduce((s, r) => s + r.percentage, 0) / d.spo2Readings.length
      : null,
    respiratory_rate: d.respiratoryReadings.length > 0
      ? d.respiratoryReadings.reduce((s, r) => s + r.breathsPerMinute, 0) / d.respiratoryReadings.length
      : null,
    wrist_temp: d.wristTemp,
    vo2max: d.vo2max,
    weather: d.weather,
    aqi: d.aqi,
    pm25: d.pm25,
    daylight_minutes: d.daylightMinutes || null,
    data_tier: dataTier,
    platform: 'ios',
    device_hrv_source: deviceHrvSource,
  };
}

export function mapToCrsScoreRow(
  userId: string,
  date: string,
  crs: CrsResult,
): CrsScoreRow {
  return {
    user_id: userId,
    date,
    score: crs.score,
    zone: crs.zone,
    confidence: crs.confidence,
    components_with_data: crs.componentsWithData,
    sleep_json: crs.sleep,
    hrv_json: crs.hrv,
    circadian_json: crs.circadian,
    activity_json: crs.activity,
    summary: crs.summary,
  };
}
