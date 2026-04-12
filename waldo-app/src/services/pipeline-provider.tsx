/**
 * PipelineProvider — initialises the HealthPipeline singleton and wires
 * AppState foreground events to catch-up queries.
 *
 * Mount <PipelineProvider> near the root of the component tree (inside QueryClientProvider).
 * Screens call usePipeline() to access the running pipeline for manual refresh.
 */

import React, { useEffect, useRef, createContext, useContext, type ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useCrsStore } from '@/store/crsStore';
import type { HealthPipeline } from './health-pipeline';

let pipelineInstance: HealthPipeline | null = null;

const PipelineContext = createContext<HealthPipeline | null>(null);

/**
 * Attempts to create the full native health pipeline.
 * Returns null if running in Expo Go (no native modules available).
 * The UI screens fetch data from Supabase directly regardless of this pipeline.
 */
async function tryCreatePipeline(
  onCrsUpdate: () => void,
): Promise<HealthPipeline | null> {
  try {
    // Dynamic imports — these will throw in Expo Go where native modules
    // are not available. Screens load data from Supabase independently.
    const [
      { OpSqliteAdapter },
      { SupabaseSyncQueue },
      { HealthPipeline },
    ] = await Promise.all([
      import('@/adapters/storage/opsqlite'),
      import('@/adapters/sync/upload-queue'),
      import('./health-pipeline'),
    ]);

    let health;
    if (Platform.OS === 'ios') {
      const { HealthKitAdapter } = await import('../../modules/healthkit/src/HealthKitAdapter');
      health = new HealthKitAdapter();
    } else {
      // Android — Health Connect
      const { HealthConnectAdapter } = await import('../../modules/health-connect/src/HealthConnectAdapter');
      health = new HealthConnectAdapter();
    }

    const storage  = new OpSqliteAdapter();
    const syncQueue = new SupabaseSyncQueue(storage, health.deviceHrvSource);

    return new HealthPipeline(health, storage, syncQueue, onCrsUpdate);
  } catch (err) {
    // Expo Go or missing native module — skip pipeline, UI runs on Supabase data only
    if (__DEV__) {
      console.warn('[PipelineProvider] Native pipeline unavailable:', err instanceof Error ? err.message : String(err));
    }
    return null;
  }
}

/** Mount near the root to initialise Health Connect / HealthKit pipeline immediately. */
export function PipelineProvider({ children }: { children: ReactNode }) {
  useCrsStore(); // subscribe — future: call refetch on CRS update
  const pipelineRef = useRef<HealthPipeline | null>(null);

  useEffect(() => {
    // Reuse existing singleton (e.g. after HMR)
    if (pipelineInstance) {
      pipelineRef.current = pipelineInstance;
      return;
    }

    let mounted = true;

    const onCrsUpdate = () => {
      // Pipeline computed a new CRS — Zustand store updated by pipeline directly.
      // This callback is a hook for future UI invalidation (TanStack Query refetch etc.)
    };

    tryCreatePipeline(onCrsUpdate).then(pipeline => {
      if (!mounted || !pipeline) return;
      pipelineInstance = pipeline;
      pipelineRef.current = pipeline;
      pipeline.initialize().catch(() => {
        console.error('[PipelineProvider] Init failed — health pipeline_init_error');
      });
    });

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        pipelineRef.current?.onForeground().catch(() => {});
      }
    });

    return () => {
      mounted = false;
      appStateSub.remove();
      pipelineInstance?.destroy();
      pipelineInstance = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PipelineContext.Provider value={pipelineRef.current}>
      {children}
    </PipelineContext.Provider>
  );
}

/** Access the running pipeline for manual refresh triggers (e.g. pull-to-refresh). */
export function usePipeline(): HealthPipeline | null {
  return useContext(PipelineContext);
}
