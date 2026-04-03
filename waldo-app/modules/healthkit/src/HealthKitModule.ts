/**
 * TypeScript bindings for the native HealthKit Expo module.
 *
 * All native function calls are validated with Zod before use.
 * This module is iOS-only — the Android equivalent is HealthConnectModule (Phase B2).
 */

import { requireNativeModule, EventEmitter, type EventSubscription } from 'expo-modules-core';
import { z } from 'zod';

const HealthKitNative = requireNativeModule('HealthKit');

type HealthKitEventMap = {
  onHealthDataUpdated: (event: { type: string }) => void;
};

const emitter = new EventEmitter<HealthKitEventMap>(HealthKitNative);

// ---------------------------------------------------------------------------
// Zod schemas for runtime validation of native module output
// ---------------------------------------------------------------------------

const HRVRecordSchema = z.object({
  timestamp: z.number(),
  sdnn: z.number().nonnegative(),
  rmssd: z.number().nonnegative().optional(),
  deviceHrvSource: z.enum(['healthkit_ibi', 'healthkit_sdnn']),
  sampleCount: z.number().int().nonnegative(),
  qualityPct: z.number().min(0).max(1),
});

const HeartRateRecordSchema = z.object({
  timestamp: z.number(),
  bpm: z.number().positive(),
  motionContext: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  source: z.string(),
});

const RestingHRRecordSchema = z.object({
  timestamp: z.number(),
  bpm: z.number().positive(),
  source: z.string(),
});

const SleepRecordSchema = z.object({
  stage: z.enum(['inBed', 'asleepCore', 'asleepDeep', 'asleepREM', 'awake']),
  startMs: z.number(),
  endMs: z.number(),
  durationMinutes: z.number().nonnegative(),
  source: z.string(),
});

const StepsResultSchema = z.object({
  totalSteps: z.number().nonnegative(),
  startMs: z.number(),
  endMs: z.number(),
  source: z.string(),
});

const SpO2RecordSchema = z.object({
  timestamp: z.number(),
  percentage: z.number().min(0).max(100),
  source: z.string(),
});

const RespiratoryRecordSchema = z.object({
  timestamp: z.number(),
  breathsPerMinute: z.number().positive(),
  source: z.string(),
});

const PermissionResultSchema = z.object({
  overall: z.enum(['granted', 'denied', 'not_determined', 'restricted', 'partial']),
  byType: z.record(z.string(), z.enum(['granted', 'denied', 'not_determined', 'restricted'])),
  deniedTypes: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type NativeHRVRecord = z.infer<typeof HRVRecordSchema>;
export type NativeHRRecord = z.infer<typeof HeartRateRecordSchema>;
export type NativeRestingHRRecord = z.infer<typeof RestingHRRecordSchema>;
export type NativeSleepRecord = z.infer<typeof SleepRecordSchema>;
export type NativeStepsResult = z.infer<typeof StepsResultSchema>;
export type NativeSpO2Record = z.infer<typeof SpO2RecordSchema>;
export type NativeRespiratoryRecord = z.infer<typeof RespiratoryRecordSchema>;
export type NativePermissionResult = z.infer<typeof PermissionResultSchema>;

// ---------------------------------------------------------------------------
// Module API
// ---------------------------------------------------------------------------

export function isHealthKitAvailable(): boolean {
  return HealthKitNative.isAvailable();
}

export async function requestPermissions(): Promise<NativePermissionResult> {
  const raw = await HealthKitNative.requestPermissions();
  return PermissionResultSchema.parse(raw);
}

export async function getPermissionStatus(): Promise<NativePermissionResult> {
  const raw = await HealthKitNative.getPermissionStatus();
  return PermissionResultSchema.parse(raw);
}

export async function queryHRV(startMs: number, endMs: number): Promise<NativeHRVRecord[]> {
  const raw = await HealthKitNative.queryHRV(startMs, endMs);
  return z.array(HRVRecordSchema).parse(raw);
}

export async function queryHeartRate(startMs: number, endMs: number): Promise<NativeHRRecord[]> {
  const raw = await HealthKitNative.queryHeartRate(startMs, endMs);
  return z.array(HeartRateRecordSchema).parse(raw);
}

export async function queryRestingHeartRate(startMs: number, endMs: number): Promise<NativeRestingHRRecord[]> {
  const raw = await HealthKitNative.queryRestingHeartRate(startMs, endMs);
  return z.array(RestingHRRecordSchema).parse(raw);
}

export async function querySleep(startMs: number, endMs: number): Promise<NativeSleepRecord[]> {
  const raw = await HealthKitNative.querySleep(startMs, endMs);
  return z.array(SleepRecordSchema).parse(raw);
}

export async function querySteps(startMs: number, endMs: number): Promise<NativeStepsResult> {
  const raw = await HealthKitNative.querySteps(startMs, endMs);
  return StepsResultSchema.parse(raw);
}

export async function querySpO2(startMs: number, endMs: number): Promise<NativeSpO2Record[]> {
  const raw = await HealthKitNative.querySpO2(startMs, endMs);
  return z.array(SpO2RecordSchema).parse(raw);
}

export async function queryRespiratoryRate(startMs: number, endMs: number): Promise<NativeRespiratoryRecord[]> {
  const raw = await HealthKitNative.queryRespiratoryRate(startMs, endMs);
  return z.array(RespiratoryRecordSchema).parse(raw);
}

export async function enableBackgroundDelivery(): Promise<void> {
  await HealthKitNative.enableBackgroundDelivery();
}

export function addHealthDataListener(
  callback: (type: string) => void
): EventSubscription {
  return emitter.addListener('onHealthDataUpdated', (event: { type: string }) => {
    callback(event.type);
  });
}
