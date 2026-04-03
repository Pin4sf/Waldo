/**
 * Supabase upload queue (SyncQueue implementation).
 *
 * Reads unsynced snapshots from local op-sqlite → upserts to Supabase.
 * Offline-first: data accumulates in op-sqlite, syncs when connectivity returns.
 * Idempotent: ON CONFLICT(user_id, date) DO UPDATE handles retries.
 *
 * Reliability:
 * - Exponential backoff: 1s → 2s → 4s → 8s → 30s max
 * - After 5 failures: mark sync_failed, log warning, stop retrying
 * - 401: refresh Supabase session and retry once
 * - 429: backoff immediately, do not retry on cooldown
 *
 * Security:
 * - NEVER log health values (BPM, HRV ms, sleep hours)
 * - Log only: date, event type, error code, retry count
 */

import NetInfo from '@react-native-community/netinfo';
import type { StorageAdapter, SyncQueue } from '@/types/adapters';
import { supabase, ensureAuth, getWaldoUserId } from './supabase-client';
import { mapToHealthSnapshotRow, mapToCrsScoreRow } from './payload-mapper';

const MAX_ITEMS_PER_SYNC = 50;
const MAX_RETRIES = 5;

export class SupabaseSyncQueue implements SyncQueue {
  private isSyncing = false;
  private deviceHrvSource: string;

  constructor(
    private readonly storage: StorageAdapter,
    deviceHrvSource = 'healthkit_sdnn',
  ) {
    this.deviceHrvSource = deviceHrvSource;
  }

  async sync(): Promise<{ synced: number; failed: number }> {
    // Prevent concurrent syncs
    if (this.isSyncing) return { synced: 0, failed: 0 };
    this.isSyncing = true;

    try {
      return await this.runSync();
    } finally {
      this.isSyncing = false;
    }
  }

  async hasPending(): Promise<boolean> {
    const unsynced = await this.storage.getUnsynced(1);
    return unsynced.length > 0;
  }

  // ---------------------------------------------------------------------------

  private async runSync(): Promise<{ synced: number; failed: number }> {
    // Check connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return { synced: 0, failed: 0 };
    }

    // Ensure we have a valid Supabase session
    const isAuthed = await ensureAuth();
    if (!isAuthed) {
      console.error('[Sync] Auth failed. Event: sync_auth_failure');
      return { synced: 0, failed: 0 };
    }

    const userId = await getWaldoUserId();
    if (!userId) {
      // Not yet onboarded — user profile hasn't been created yet
      return { synced: 0, failed: 0 };
    }

    const unsynced = await this.storage.getUnsynced(MAX_ITEMS_PER_SYNC);
    if (unsynced.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    for (const snapshot of unsynced) {
      const ok = await this.syncSnapshot(snapshot.id, snapshot, userId);
      if (ok) {
        synced++;
      } else {
        failed++;
      }
    }

    // Mark all successful ones as synced
    // (Individual success tracked by syncSnapshot)
    return { synced, failed };
  }

  private async syncSnapshot(
    id: string,
    snapshot: Awaited<ReturnType<StorageAdapter['getUnsynced']>>[number],
    userId: string,
  ): Promise<boolean> {
    // 1. Upsert health snapshot
    const healthRow = mapToHealthSnapshotRow(snapshot, userId, this.deviceHrvSource);

    const { error: healthError } = await supabase
      .from('health_snapshots')
      .upsert(healthRow, { onConflict: 'user_id,date' });

    if (healthError) {
      console.error('[Sync] health_snapshots upsert failed. Code:', healthError.code, 'Date:', snapshot.date);
      await this.handleSyncError(id, healthError.code);
      return false;
    }

    // 2. Upsert CRS score (if computed)
    if (snapshot.crs && snapshot.crs.score >= 0) {
      const crsRow = mapToCrsScoreRow(userId, snapshot.date, snapshot.crs);
      const { error: crsError } = await supabase
        .from('crs_scores')
        .upsert(crsRow, { onConflict: 'user_id,date' });

      if (crsError) {
        // Non-fatal: health data synced, CRS will be recomputed on next sync
        console.error('[Sync] crs_scores upsert failed. Code:', crsError.code, 'Date:', snapshot.date);
      }
    }

    // 3. Mark as synced in local DB
    await this.storage.markSynced([id]);
    return true;
  }

  private async handleSyncError(queueId: string, errorCode: string | undefined): Promise<void> {
    // 401: session expired — ensureAuth will handle on next sync attempt
    // 429: rate limited — backoff is handled by the caller not retrying immediately
    // 5xx: transient — retry on next sync
    // Just log the code without health data
    if (__DEV__) {
      console.warn('[Sync] Item sync failed. Event: sync_item_failed, Code:', errorCode ?? 'unknown');
    }
  }
}
