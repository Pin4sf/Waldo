-- Waldo — Spotify + Google Fit + Multi-device architecture
-- April 2026

-- ─── Multi-device support ────────────────────────────────────────
-- Each health snapshot can now track which device(s) contributed data.
-- When multiple devices sync the same date, data is merged (not overwritten).

ALTER TABLE health_snapshots
  ADD COLUMN IF NOT EXISTS device_id TEXT,           -- e.g. 'apple_watch_s9', 'galaxy_watch_6', 'garmin_265'
  ADD COLUMN IF NOT EXISTS device_type TEXT,         -- 'apple_watch' | 'galaxy_watch' | 'garmin' | 'google_fit' | 'manual'
  ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '[]'; -- array of {device_id, device_type, synced_at, metrics_contributed[]}

-- Multi-device index: query by user + date still primary
CREATE INDEX IF NOT EXISTS idx_health_snapshots_device ON health_snapshots(user_id, device_type, date);

-- ─── Device registry: track all devices per user ──────────────────
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,           -- unique identifier per device
  device_type TEXT NOT NULL,         -- 'apple_watch' | 'galaxy_watch' | 'android_phone' | 'garmin' | 'whoop' | 'oura'
  device_name TEXT,                  -- "Ark's Apple Watch Series 9"
  platform TEXT NOT NULL,            -- 'ios' | 'android' | 'web'
  last_seen_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT true,
  UNIQUE(user_id, device_id)
);
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_user_devices" ON user_devices FOR SELECT TO anon USING (true);
CREATE POLICY "auth_own_user_devices" ON user_devices FOR ALL TO authenticated USING (user_id = waldo_user_id());

-- ─── Spotify OAuth tokens (separate from Google) ─────────────────
-- spotify tokens stored in oauth_tokens with provider = 'spotify'
-- (oauth_tokens table already supports any provider string)

-- Add Spotify sync to sync_log providers (just insert when syncing)
-- No schema change needed — sync_log.provider is a free-form TEXT field

-- ─── Google Fit / Health Connect data ────────────────────────────
-- Google Fit is the web-accessible API that aggregates data from
-- Health Connect on Android + connected wearables.
-- Same health_snapshots table, device_type = 'google_fit'
-- Add Google Fit scopes to oauth_tokens tracking
-- No schema change needed — stored as provider = 'google', extra scopes

-- ─── Mood metrics: add Spotify provider support ───────────────────
-- mood_metrics.provider already supports any string
-- Spotify will write provider = 'spotify' with better data than YouTube:
-- avg_energy, avg_valence, avg_tempo all populated from audio features API

-- ─── pg_cron: Spotify sync nightly at 3:30 AM UTC ────────────────
SELECT cron.schedule(
  'waldo-sync-spotify',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT replace(decrypted_secret, '/check-triggers', '/sync-spotify')
      FROM vault.decrypted_secrets WHERE name = 'waldo_check_triggers_url'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'waldo_anon_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ─── pg_cron: Google Fit sync nightly at 4:30 AM UTC ────────────
SELECT cron.schedule(
  'waldo-sync-google-fit',
  '30 4 * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT replace(decrypted_secret, '/check-triggers', '/sync-google-fit')
      FROM vault.decrypted_secrets WHERE name = 'waldo_check_triggers_url'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'waldo_anon_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Anon read for new table
DROP POLICY IF EXISTS "anon_read_user_devices" ON user_devices;
CREATE POLICY "anon_read_user_devices" ON user_devices FOR SELECT TO anon USING (true);
