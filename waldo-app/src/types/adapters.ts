/**
 * Adapter interfaces (ports) for all external integrations.
 *
 * Core logic (CRS engine, agent reasoning, delivery orchestration) NEVER
 * imports a provider directly. All external boundaries go through these interfaces.
 *
 * Architecture: Hexagonal (Ports & Adapters)
 * Rule: swapping a provider should require changing ONLY the adapter implementation.
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
  DateRange,
} from './health';
import type { CrsResult, Baselines } from '@/crs/types';

// ---------------------------------------------------------------------------
// Shared result wrapper — adapters never throw for expected failures
// ---------------------------------------------------------------------------

export type AdapterResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: AdapterErrorCode };

export type AdapterErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_DATA'
  | 'API_UNAVAILABLE'
  | 'DISK_FULL'
  | 'ENCRYPTION_ERROR'
  | 'NETWORK_ERROR'
  | 'AUTH_EXPIRED'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

// ---------------------------------------------------------------------------
// HealthDataSource — wearable / health platform adapter
// Implementations: HealthKitAdapter (iOS), HealthConnectAdapter (Android)
// ---------------------------------------------------------------------------

export type HealthDataType =
  | 'hrv'
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'sleep'
  | 'steps'
  | 'spo2'
  | 'respiratory_rate';

export type PermissionStatus =
  | 'granted'
  | 'denied'
  | 'not_determined'
  | 'restricted';

export interface PermissionResult {
  overall: PermissionStatus;
  byType: Record<HealthDataType, PermissionStatus>;
  deniedTypes: HealthDataType[];
}

export interface HealthDataSource {
  readonly platform: 'ios' | 'android';
  /**
   * HRV data source determines which CRS computation path is used.
   * healthkit_ibi = true RMSSD from beat-to-beat data (most accurate)
   * healthkit_sdnn = SDNN fallback (converted to RMSSD-equivalent, ~0.75x)
   */
  readonly deviceHrvSource: DeviceHrvSourceType;

  // -- Permission lifecycle --
  requestPermissions(): Promise<PermissionResult>;
  getPermissionStatus(): Promise<PermissionResult>;

  // -- Data queries (all return AdapterResult, never throw) --
  queryHRV(range: DateRange): Promise<AdapterResult<HRVRecord[]>>;
  queryHeartRate(range: DateRange): Promise<AdapterResult<HRRecord[]>>;
  queryRestingHeartRate(range: DateRange): Promise<AdapterResult<RestingHRRecord[]>>;
  querySleep(range: DateRange): Promise<AdapterResult<SleepStageRecord[]>>;
  querySteps(range: DateRange): Promise<AdapterResult<StepRecord[]>>;
  querySpO2(range: DateRange): Promise<AdapterResult<SpO2Record[]>>;
  queryRespiratoryRate(range: DateRange): Promise<AdapterResult<RespiratoryRateRecord[]>>;

  // -- Background delivery --
  /**
   * Register for background updates. Must be called once on app init.
   * iOS: wraps HKObserverQuery + enableBackgroundDelivery
   * Android: wraps Health Connect background reads via WorkManager
   */
  enableBackgroundDelivery(types: HealthDataType[]): Promise<void>;
  /**
   * Subscribe to new-data events from background delivery.
   * Returns an unsubscribe function.
   */
  onNewData(callback: (type: HealthDataType) => void): () => void;
}

export type DeviceHrvSourceType =
  | 'healthkit_ibi'
  | 'healthkit_sdnn'
  | 'health_connect_rmssd'
  | 'hr_proxy'
  | 'none';

// ---------------------------------------------------------------------------
// StorageAdapter — encrypted local persistence
// Implementation: OpSqliteAdapter (op-sqlite + SQLCipher AES-256)
// ---------------------------------------------------------------------------

/** A row in the local daily_snapshots table */
export interface LocalSnapshot {
  id: string;
  date: string;           // 'YYYY-MM-DD'
  data: DailyHealthData;
  crs: CrsResult | null;
  synced: boolean;
  createdAt: number;      // Unix ms
  updatedAt: number;
}

/** Persisted baselines for CRS computation */
export interface StoredBaselines {
  baselines: Baselines;
  updatedAt: number;
}

export interface StorageAdapter {
  /** Must be called before any other operation. Derives key from Keychain. */
  initDb(): Promise<void>;

  /** Insert or update a daily snapshot */
  upsertSnapshot(snapshot: Omit<LocalSnapshot, 'synced' | 'createdAt' | 'updatedAt'>): Promise<void>;

  /** Get snapshots not yet synced to Supabase */
  getUnsynced(limit?: number): Promise<LocalSnapshot[]>;

  /** Mark snapshot IDs as synced */
  markSynced(ids: string[]): Promise<void>;

  /** Get recent snapshots for CRS baseline computation */
  getRecentSnapshots(days: number): Promise<LocalSnapshot[]>;

  /** Get the most recent snapshot */
  getLatestSnapshot(): Promise<LocalSnapshot | null>;

  /** Baselines */
  getBaselines(): Promise<StoredBaselines | null>;
  upsertBaselines(baselines: StoredBaselines): Promise<void>;
}

// ---------------------------------------------------------------------------
// SyncQueue — Supabase upload queue
// ---------------------------------------------------------------------------

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface SyncQueue {
  /** Drain the queue: sync all pending local snapshots to Supabase */
  sync(): Promise<{ synced: number; failed: number }>;
  /** True if there are pending items in the queue */
  hasPending(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Channel Adapter — messaging delivery (Phase D)
// Stub for now; will be implemented in Phase D with Telegram first
// ---------------------------------------------------------------------------

export interface ChannelAdapter {
  readonly channelType: 'telegram' | 'whatsapp' | 'discord' | 'slack' | 'in_app';
  sendMessage(userId: string, content: string): Promise<AdapterResult<{ messageId: string }>>;
  isLinked(userId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// LLMProvider — AI model adapter (Phase D)
// Stub for now; will be implemented in Phase D with Claude Haiku
// ---------------------------------------------------------------------------

export interface LLMProvider {
  readonly model: string;
  generateResponse(prompt: string, tools?: unknown[]): Promise<AdapterResult<string>>;
}

// ---------------------------------------------------------------------------
// WeatherProvider — environmental context (already built in tools/)
// Stub for Phase B; will be wired in Phase C/D
// ---------------------------------------------------------------------------

export interface WeatherProvider {
  getCurrentConditions(lat: number, lon: number): Promise<AdapterResult<WeatherConditions>>;
}

export interface WeatherConditions {
  temperatureF: number;
  humidity: number;
  aqi: number | null;
  pm25: number | null;
}
