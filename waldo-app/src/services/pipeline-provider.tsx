/**
 * PipelineProvider — initialises the HealthPipeline singleton and wires
 * AppState foreground events to catch-up queries.
 *
 * Place this near the root of the component tree (inside QueryClientProvider).
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { HealthKitAdapter } from '../../modules/healthkit/src/HealthKitAdapter';
import { OpSqliteAdapter } from '@/adapters/storage/opsqlite';
import { SupabaseSyncQueue } from '@/adapters/sync/upload-queue';
import { HealthPipeline } from './health-pipeline';
import { useCrsStore } from '@/store/crsStore';

let pipelineInstance: HealthPipeline | null = null;

export function usePipeline() {
  const { setCrsResult } = useCrsStore();
  const pipelineRef = useRef<HealthPipeline | null>(null);

  useEffect(() => {
    // Singleton: only initialise once across renders
    if (pipelineInstance) {
      pipelineRef.current = pipelineInstance;
      return;
    }

    const health = new HealthKitAdapter();
    const storage = new OpSqliteAdapter();
    const syncQueue = new SupabaseSyncQueue(storage, health.deviceHrvSource);

    const pipeline = new HealthPipeline(
      health,
      storage,
      syncQueue,
      // onCrsUpdate: triggers a re-read from storage → Zustand
      async () => {
        const latest = await storage.getLatestSnapshot();
        if (latest?.crs) {
          setCrsResult(latest.crs);
        }
      },
    );

    pipelineInstance = pipeline;
    pipelineRef.current = pipeline;

    pipeline.initialize().catch((_err) => {
      console.error('[PipelineProvider] Init failed. Event: pipeline_init_error');
    });

    // AppState listener: run catch-up when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        pipelineRef.current?.onForeground().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
      pipeline.destroy();
      pipelineInstance = null;
    };
  }, [setCrsResult]);

  return pipelineRef.current;
}
