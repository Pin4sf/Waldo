/**
 * Zustand store for CRS state.
 * Single source of truth for the current Nap Score displayed to the user.
 */

import { create } from 'zustand';
import type { CrsResult } from '@/crs/types';

interface CrsStore {
  crsResult: CrsResult | null;
  isComputing: boolean;
  lastUpdatedAt: Date | null;
  setCrsResult: (result: CrsResult | null) => void;
  setIsComputing: (computing: boolean) => void;
}

export const useCrsStore = create<CrsStore>((set) => ({
  crsResult: null,
  isComputing: false,
  lastUpdatedAt: null,
  setCrsResult: (result) =>
    set({ crsResult: result, lastUpdatedAt: result ? new Date() : null }),
  setIsComputing: (computing) => set({ isComputing: computing }),
}));
