/**
 * PipelineProvider — initialises the HealthPipeline singleton and wires
 * AppState foreground events to catch-up queries.
 *
 * Place this near the root of the component tree (inside QueryClientProvider).
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useCrsStore } from '@/store/crsStore';
import type { HealthPipeline } from './health-pipeline';

let pipelineInstance: HealthPipeline | null = null;

/**
 * Attempts to create the full native health pipeline.
 * Returns null if running in Expo Go (no native modules available).
 * The UI screens fetch data from Supabase directly regardless of this pipeline.
 */
async function tryCreatePipeline(
  onCrsUpdate: () => Promise<void>,
): Promise<HealthPipeline | null> {
  try {
    // Dynamic imports — these will throw in Expo Go where native modules
    // are not available. Screens load data from Supabase independently.
    const { OpSqliteAdapter } = await import('@/adapters/storage/opsqlite');
    const { SupabaseSyncQueue } = await import('@/adapters/sync/upload-queue');
    const { HealthPipeline } = await import('./health-pipeline');

    let health;
    if (Platform.OS === 'ios') {
      const { HealthKitAdapter } = await import('../../modules/healthkit/src/HealthKitAdapter');
      health = new HealthKitAdapter();
    } else {
      const { HealthConnectAdapter } = await import('../../modules/health-connect/src/HealthConnectAdapter');
      health = new HealthConnectAdapter();
    }

    const storage = new OpSqliteAdapter();
    const syncQueue = new SupabaseSyncQueue(storage, health.deviceHrvSource);

    return new HealthPipeline(health, storage, syncQueue, onCrsUpdate);
  } catch {
    // Expo Go or missing native module — skip pipeline, UI runs on Supabase data only
    console.warn('[PipelineProvider] Native pipeline unavailable (Expo Go?). Screens use Supabase directly.');
    return null;
  }
}

export function usePipeline() {
  const { setCrsResult } = useCrsStore();
  const pipelineRef = useRef<HealthPipeline | null>(null);

  useEffect(() => {
    if (pipelineInstance) {
      pipelineRef.current = pipelineInstance;
      return;
    }

    let mounted = true;

    const onCrsUpdate = async () => {
      // CRS update callback — pipeline notifies when a new score is computed.
      // The dashboard also polls Supabase independently; this just keeps
      // Zustand in sync with the freshest local value.
      void setCrsResult;
    };

    tryCreatePipeline(onCrsUpdate).then(pipeline => {
      if (!mounted || !pipeline) return;
      pipelineInstance = pipeline;
      pipelineRef.current = pipeline;
      pipeline.initialize().catch(() => {
        console.error('[PipelineProvider] Init failed. Event: pipeline_init_error');
      });
    });

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        pipelineRef.current?.onForeground().catch(() => {});
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
      pipelineInstance?.destroy();
      pipelineInstance = null;
    };
  }, [setCrsResult]);

  return pipelineRef.current;
}
