-- Migration: New integrations support (RescueTime, Todoist, Strava, Notion, Linear)
-- Date: 2026-04-10

-- ═══════════════════════════════════════════════════════════════
-- Screen Time Metrics (RescueTime + future sources)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS screen_time_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'rescuetime',
  productive_hours REAL,
  distracted_hours REAL,
  neutral_hours REAL,
  total_hours REAL,
  productivity_score REAL,          -- 0-100
  top_category TEXT,                -- e.g., 'Software Development', 'Communication'
  focus_sessions INT DEFAULT 0,     -- uninterrupted 25min+ blocks
  late_night_screen BOOLEAN DEFAULT false,  -- activity after 10pm
  raw_summary JSONB,                -- full hourly breakdown
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date, provider)
);

CREATE INDEX idx_screen_time_user_date ON screen_time_metrics(user_id, date);

-- RLS
ALTER TABLE screen_time_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own screen time"
  ON screen_time_metrics FOR SELECT
  USING (auth.uid()::text = user_id::text OR current_setting('role') = 'service_role');

CREATE POLICY "Service role full access screen_time"
  ON screen_time_metrics FOR ALL
  USING (current_setting('role') = 'service_role');

-- Anon read for demo console
CREATE POLICY "Anon read screen_time"
  ON screen_time_metrics FOR SELECT TO anon
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- Add provider tracking to task_metrics for multi-source tasks
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE task_metrics ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'google_tasks';

-- ═══════════════════════════════════════════════════════════════
-- Nightly consolidation support: diary entries in core_memory
-- (No new table needed — diary entries stored as core_memory keys
--  with format: diary_YYYY-MM-DD)
-- ═══════════════════════════════════════════════════════════════

-- Add hall_type column to core_memory for typed memory halls (MemPalace pattern)
ALTER TABLE core_memory ADD COLUMN IF NOT EXISTS hall_type TEXT DEFAULT 'facts'
  CHECK (hall_type IN ('facts', 'events', 'discoveries', 'preferences', 'advice'));

-- Add temporal fact invalidation columns (MemPalace pattern)
ALTER TABLE core_memory ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT now();
ALTER TABLE core_memory ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ;  -- NULL = still valid
ALTER TABLE core_memory ADD COLUMN IF NOT EXISTS superseded_by TEXT;    -- key of replacement

-- ═══════════════════════════════════════════════════════════════
-- pg_cron jobs for new sync functions
-- ═══════════════════════════════════════════════════════════════

-- RescueTime: nightly 3:00 AM UTC
SELECT cron.schedule(
  'sync-rescuetime',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-rescuetime',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key')
    ),
    body := '{}'::jsonb
  )$$
);

-- Todoist: nightly 3:50 AM UTC
SELECT cron.schedule(
  'sync-todoist',
  '50 3 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-todoist',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key')
    ),
    body := '{}'::jsonb
  )$$
);

-- Strava: nightly 4:00 AM UTC
SELECT cron.schedule(
  'sync-strava',
  '0 4 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-strava',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key')
    ),
    body := '{}'::jsonb
  )$$
);

-- Notion: nightly 4:10 AM UTC
SELECT cron.schedule(
  'sync-notion',
  '10 4 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-notion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key')
    ),
    body := '{}'::jsonb
  )$$
);

-- Linear: nightly 4:15 AM UTC
SELECT cron.schedule(
  'sync-linear',
  '15 4 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-linear',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key')
    ),
    body := '{}'::jsonb
  )$$
);

-- Nightly consolidation (Dreaming Mode Lite): 2:00 AM UTC
SELECT cron.schedule(
  'nightly-consolidation',
  '0 2 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/nightly-consolidation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key')
    ),
    body := '{}'::jsonb
  )$$
);
