import type { DateEntry } from '../../types.js';

export interface DashboardHistoryContext {
  hrv30d: Array<number | null>;
  rhr7d: Array<number | null>;
  sleepDebt7d: Array<number | null>;
  strain7d: Array<number | null>;
  sleepHours7d: Array<number | null>;
  previousEntry: DateEntry | null;
}
