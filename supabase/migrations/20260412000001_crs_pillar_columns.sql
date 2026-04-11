-- Add pillar scores and drag analysis to crs_scores
-- These columns are populated by the updated CRS engine (April 2026 spec).
-- pillars_json: { recovery, cass, ilas } — the 3-pillar breakdown
-- pillar_drag_json: { sleep, hrv, circadian, activity, primary } — drag attribution for The Brief

ALTER TABLE crs_scores
  ADD COLUMN IF NOT EXISTS pillars_json JSONB,     -- {recovery: int, cass: int, ilas: int}
  ADD COLUMN IF NOT EXISTS pillar_drag_json JSONB; -- {sleep, hrv, circadian, activity, primary}

-- Backfill comment: existing rows will have NULL pillars_json/pillar_drag_json
-- until the seeder is re-run with the new engine. The dashboard handles NULL gracefully.
