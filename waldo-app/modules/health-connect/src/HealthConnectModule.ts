/**
 * TypeScript bindings for the Waldo Health Connect native module.
 * Android only — iOS uses HealthKit via modules/healthkit/.
 *
 * Lazy-loads the native module so the file can be imported safely on iOS
 * (will return null from getNative() on non-Android platforms).
 */
import { Platform } from 'react-native';

function getNative(): Record<string, (...args: unknown[]) => unknown> | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-modules-core').requireNativeModule('HealthConnect');
  } catch {
    return null;
  }
}

export interface NativeHRResult {
  restingHR: number;
  avgHR: number;
  sampleCount: number;
  source: 'health_connect' | 'mock';
}

export interface NativeHRVResult {
  rmssd: number;
  readingCount: number;
  source: 'health_connect_rmssd' | 'hr_variance_proxy' | 'mock';
  isSamsungProxy: boolean;
}

export interface NativeSleepResult {
  durationHours: number;
  startTime: number;
  endTime: number;
  stages: { deep: number; rem: number; light: number; awake: number } | null;
  source: 'health_connect' | 'mock';
}

export interface NativeStepsResult {
  steps: number;
  source: 'health_connect' | 'mock' | 'error';
}

export interface NativeSpO2Result {
  avgPct: number | null;
  count: number;
}

export interface NativeExerciseResult {
  minutesTotal: number;
  sessionCount: number;
}

const native = getNative();

export function isAvailable(): boolean {
  return (native?.isAvailable?.() as boolean | undefined) ?? false;
}

export async function hasPermissions(): Promise<boolean> {
  return (native?.hasPermissions?.() as Promise<boolean> | undefined) ?? Promise.resolve(false);
}

export async function requestPermissions(): Promise<string[]> {
  return (native?.requestPermissions?.() as Promise<string[]> | undefined) ?? Promise.resolve([]);
}

export async function readHeartRate(dateStr: string): Promise<NativeHRResult> {
  return (native?.readHeartRate?.(dateStr) as Promise<NativeHRResult> | undefined) ??
    Promise.resolve({ restingHR: 0, avgHR: 0, sampleCount: 0, source: 'mock' });
}

export async function readHRV(dateStr: string): Promise<NativeHRVResult> {
  return (native?.readHRV?.(dateStr) as Promise<NativeHRVResult> | undefined) ??
    Promise.resolve({ rmssd: 0, readingCount: 0, source: 'mock', isSamsungProxy: false });
}

export async function readSleep(dateStr: string): Promise<NativeSleepResult> {
  return (native?.readSleep?.(dateStr) as Promise<NativeSleepResult> | undefined) ??
    Promise.resolve({ durationHours: 0, startTime: 0, endTime: 0, stages: null, source: 'mock' });
}

export async function readSteps(dateStr: string): Promise<NativeStepsResult> {
  return (native?.readSteps?.(dateStr) as Promise<NativeStepsResult> | undefined) ??
    Promise.resolve({ steps: 0, source: 'mock' });
}

export async function readSpO2(dateStr: string): Promise<NativeSpO2Result> {
  return (native?.readSpO2?.(dateStr) as Promise<NativeSpO2Result> | undefined) ??
    Promise.resolve({ avgPct: null, count: 0 });
}

export async function readRestingHR(dateStr: string): Promise<{ bpm: number | null }> {
  return (native?.readRestingHR?.(dateStr) as Promise<{ bpm: number | null }> | undefined) ??
    Promise.resolve({ bpm: null });
}

export async function readExercise(dateStr: string): Promise<NativeExerciseResult> {
  return (native?.readExercise?.(dateStr) as Promise<NativeExerciseResult> | undefined) ??
    Promise.resolve({ minutesTotal: 0, sessionCount: 0 });
}
