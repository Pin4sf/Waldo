-- Phase B1: Add platform and HRV source tracking fields to health_snapshots
-- These fields tell the agent which data path was used, affecting CRS accuracy.

ALTER TABLE health_snapshots
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'ios',
  ADD COLUMN IF NOT EXISTS device_hrv_source TEXT DEFAULT 'healthkit_sdnn';

-- Add hrv_rmssd column if it doesn't exist (the demo schema used hrv_rmssd already)
-- This is a no-op if the column exists, but documents the intent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_snapshots' AND column_name = 'hrv_rmssd'
  ) THEN
    ALTER TABLE health_snapshots ADD COLUMN hrv_rmssd REAL;
  END IF;
END $$;

-- Index for common query: get snapshots by platform
CREATE INDEX IF NOT EXISTS idx_health_snapshots_platform ON health_snapshots (user_id, platform, date);
