/**
 * HealthPipeline — orchestrates the full data flow.
 *
 * Flow: HealthKit event → query all 7 types → aggregate → CRS → op-sqlite → Supabase sync
 *
 * Called from:
 * 1. Native module background delivery callbacks (onNewData)
 * 2. AppState foreground transitions (catch-up queries)
 * 3. Manual refresh from UI
 *
 * Background execution constraint:
 * - iOS gives < 30s for background tasks
 * - CRITICAL: Supabase sync must NOT block the HKObserverQuery completionHandler
 *   Solution: local SQLite write FIRST (fast), then sync async (fire-and-forget)
 *
 * Security:
 * - NEVER log health values in this class
 * - Log only: event types, error codes, timing metadata
 */

import type { HealthDataSource, StorageAdapter, SyncQueue } from '@/types/adapters';
import { aggregateDailyData, localDateString, getTodayRange, getLastNightRange } from '@/crs/aggregator';
import { computeCrs } from '@/crs/engine';
import type { DailyHealthData } from '@/types/health';
import type { LocationAdapter } from '@/adapters/location/location-adapter';
import { v4 as uuid } from 'uuid';

/** How many recent days to load for CRS baseline computation */
const BASELINE_LOOKBACK_DAYS = 30;

export class HealthPipeline {
  private isRunning = false;
  private unsubscribeHealthEvents: (() => void) | null = null;
  private lastSyncAt: Date | null = null;

  constructor(
    private readonly health: HealthDataSource,
    private readonly storage: StorageAdapter,
    private readonly syncQueue: SyncQueue,
    /** Called when CRS recomputes — updates UI store */
    private readonly onCrsUpdate: () => void,
    /** Optional — provides GPS-based weather. Omit to skip weather enrichment. */
    private readonly location?: LocationAdapter,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async initialize(): Promise<void> {
    await this.storage.initDb();

    // Register for background delivery from HealthKit
    try {
      await this.health.enableBackgroundDelivery([
        'hrv', 'heart_rate', 'resting_heart_rate', 'sleep',
        'steps', 'spo2', 'respiratory_rate',
      ]);
    } catch {
      // Background delivery may not be available in Simulator
      // Log event only — no health values
      console.warn('[Pipeline] Background delivery registration failed. Event: bg_delivery_unavailable');
    }

    // Subscribe to new-data events
    this.unsubscribeHealthEvents = this.health.onNewData((_type) => {
      // Fire-and-forget — must not block the HKObserverQuery completionHandler
      // The native Swift layer calls completionHandler() immediately in BackgroundDelivery.swift
      this.runPipeline('background_event').catch((_err) => {
        console.error('[Pipeline] Background pipeline failed. Event: pipeline_error');
      });
    });

    // Run an initial catch-up on startup
    await this.runPipeline('startup');
  }

  destroy(): void {
    this.unsubscribeHealthEvents?.();
    this.unsubscribeHealthEvents = null;
  }

  /** Called on AppState 'active' — catches any data that arrived while app was backgrounded */
  async onForeground(): Promise<void> {
    const now = Date.now();
    const lastSyncMs = this.lastSyncAt?.getTime() ?? 0;
    const staleSec = (now - lastSyncMs) / 1000;

    // Only run if data is > 5 minutes stale
    if (staleSec > 300) {
      await this.runPipeline('foreground_resume');
    }
  }

  // ---------------------------------------------------------------------------
  // Core pipeline
  // ---------------------------------------------------------------------------

  async runPipeline(trigger: string): Promise<void> {
    // Prevent concurrent pipeline runs
    if (this.isRunning) return;
    this.isRunning = true;

    const startMs = Date.now();

    try {
      // Step 1: Query all 7 health data types from HealthKit
      const today = localDateString();
      const todayRange = getTodayRange();
      const sleepRange = getLastNightRange();

      const [hrv, heartRate, restingHR, sleep, steps, spo2, respiratoryRate] = await Promise.all([
        this.health.queryHRV(todayRange),
        this.health.queryHeartRate(todayRange),
        this.health.queryRestingHeartRate(todayRange),
        this.health.querySleep(sleepRange),
        this.health.querySteps(todayRange),
        this.health.querySpO2(todayRange),
        this.health.queryRespiratoryRate(todayRange),
      ]);

      // Step 2: Fetch weather from GPS (non-blocking — failure is acceptable)
      let weatherData: DailyHealthData['weather'] = null;
      if (this.location) {
        const weatherResult = await this.location.getCurrentWeather().catch(() => null);
        if (weatherResult?.ok) {
          weatherData = {
            temperatureF: weatherResult.data.tempC * 9 / 5 + 32,
            humidity: weatherResult.data.humidity,
            source: 'api',
          };
        }
      }

      // Step 3: Aggregate into DailyHealthData
      const rawAggregate = aggregateDailyData(today, {
        hrv: hrv.ok ? hrv.data : [],
        heartRate: heartRate.ok ? heartRate.data : [],
        restingHR: restingHR.ok ? restingHR.data : [],
        sleep: sleep.ok ? sleep.data : [],
        steps: steps.ok ? steps.data : [],
        spo2: spo2.ok ? spo2.data : [],
        respiratoryRate: respiratoryRate.ok ? respiratoryRate.data : [],
      });

      // Inject weather into aggregate
      const dailyData: DailyHealthData = weatherData
        ? { ...rawAggregate, weather: weatherData }
        : rawAggregate;

      // Step 4: Load historical data for CRS baseline computation
      const recentSnapshots = await this.storage.getRecentSnapshots(BASELINE_LOOKBACK_DAYS);
      const allDays = new Map<string, DailyHealthData>();
      for (const snap of recentSnapshots) {
        allDays.set(snap.date, snap.data);
      }
      // Add today's fresh data
      allDays.set(today, dailyData);

      // Step 5: Compute CRS (pure synchronous, < 1ms)
      const crsResult = computeCrs(dailyData, allDays);

      // Step 6: Write to local encrypted storage (fast — must complete before background window closes)
      await this.storage.upsertSnapshot({
        id: uuid(),
        date: today,
        data: dailyData,
        crs: crsResult,
      });

      this.lastSyncAt = new Date();

      // Step 7: Notify UI to refresh (Zustand store update)
      this.onCrsUpdate();

      // Step 8: Sync to Supabase (non-blocking — do NOT await in background handler)
      // Use void + catch to ensure completionHandler isn't blocked
      void this.syncQueue.sync().catch((_err) => {
        console.error('[Pipeline] Supabase sync failed. Event: supabase_sync_error');
      });

      const elapsedMs = Date.now() - startMs;
      // Log timing only — no health values
      if (__DEV__) {
        console.log(`[Pipeline] Complete. Trigger: ${trigger}, Elapsed: ${elapsedMs}ms, Zone: ${crsResult.score >= 0 ? crsResult.zone : 'insufficient'}`);
      }
    } catch (_err) {
      console.error('[Pipeline] Failed. Trigger:', trigger, 'Event: pipeline_uncaught_error');
    } finally {
      this.isRunning = false;
    }
  }
}
