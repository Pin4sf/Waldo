-- Multi-device support: data_sources tracking + wearable_devices array
--
-- data_sources: per-row JSONB tracking which source contributed each metric.
-- Example: { "hrv": "whoop", "sleep": "apple_health", "activity": "apple_health" }
-- Lets the agent explain "Your HRV comes from WHOOP, sleep from Apple Watch."
--
-- wearable_devices: replaces single wearable_type — user can have multiple devices.

ALTER TABLE health_snapshots
  ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '{}';

-- wearable_devices as array; keep wearable_type for backwards compat
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wearable_devices TEXT[] DEFAULT '{}';

-- Migrate existing wearable_type into wearable_devices array
UPDATE users
  SET wearable_devices = ARRAY[wearable_type]
  WHERE wearable_type IS NOT NULL AND array_length(wearable_devices, 1) IS NULL;

CREATE INDEX IF NOT EXISTS idx_health_snapshots_data_sources
  ON health_snapshots USING gin(data_sources);
