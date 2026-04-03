/**
 * useCrs — React hook for current CRS state.
 *
 * Reads historical snapshots from storage → runs CRS computation → returns result.
 * Subscribes to health data updates from the native module.
 *
 * Performance contract:
 * - Storage read (async, I/O): happens before compute
 * - CRS compute (sync, pure): < 1ms
 * - Total update latency target: < 500ms from new data event
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCrsStore } from '@/store/crsStore';
import { computeCrs, localDateString } from '@/crs';
import type { DailyHealthData } from '@/types/health';
import type { StorageAdapter } from '@/types/adapters';
import type { CrsResult } from '@/crs/types';

interface UseCrsOptions {
  storage: StorageAdapter;
}

export function useCrs({ storage }: UseCrsOptions) {
  const { crsResult, setCrsResult, isComputing, setIsComputing } = useCrsStore();
  const isRunningRef = useRef(false);

  const computeLatestCrs = useCallback(async (): Promise<void> => {
    // Prevent concurrent computation runs
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsComputing(true);

    try {
      // 1. Load 30 days of historical snapshots from encrypted local DB
      const snapshots = await storage.getRecentSnapshots(30);

      // 2. Build the Map<date, DailyHealthData> required by CRS engine
      const allDays = new Map<string, DailyHealthData>();
      for (const snap of snapshots) {
        allDays.set(snap.date, snap.data);
      }

      if (allDays.size === 0) {
        setCrsResult(null);
        return;
      }

      // 3. Compute CRS for today (pure synchronous, < 1ms)
      const today = localDateString();
      const todayData = allDays.get(today);

      if (!todayData) {
        // No data for today yet — return most recent available
        const sortedDates = [...allDays.keys()].sort();
        const mostRecent = sortedDates[sortedDates.length - 1];
        if (!mostRecent) {
          setCrsResult(null);
          return;
        }
        const result = computeCrs(allDays.get(mostRecent)!, allDays);
        setCrsResult(result);
        return;
      }

      const result = computeCrs(todayData, allDays);
      setCrsResult(result);
    } finally {
      isRunningRef.current = false;
      setIsComputing(false);
    }
  }, [storage, setCrsResult, setIsComputing]);

  return {
    crsResult,
    isComputing,
    refresh: computeLatestCrs,
  };
}
