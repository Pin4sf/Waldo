-- P1 field additions to health_snapshots
-- Unblocks WHAS (walking HR), PES (physical effort), CDP (timezone shift)
-- in the CRS engine. All three were placeholder 75/100 before this.

ALTER TABLE health_snapshots
  ADD COLUMN IF NOT EXISTS walking_heart_rate  REAL,     -- bpm avg (for WHAS in CASS)
  ADD COLUMN IF NOT EXISTS physical_effort     REAL,     -- kcal/hr·kg avg (for PES in ILAS)
  ADD COLUMN IF NOT EXISTS sleep_timezone_offset REAL;   -- hours offset e.g. 5.5 for IST (for CDP in ILAS)

-- Indices not needed — these are accessed via single-row lookups by (user_id, date).
