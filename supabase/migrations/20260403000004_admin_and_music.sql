-- Waldo — Admin flag + YouTube Music metrics
-- is_admin: marks super admins (can view all users in console/mobile)
-- mood_metrics: YouTube Music / Spotify listening mood inference

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- mood_metrics: daily listening mood from music data
CREATE TABLE IF NOT EXISTS mood_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'youtube_music',  -- 'youtube_music' | 'spotify'
  tracks_played INTEGER DEFAULT 0,
  avg_energy REAL,          -- 0.0-1.0 (high = energetic)
  avg_valence REAL,         -- 0.0-1.0 (high = positive/happy)
  avg_tempo REAL,           -- BPM
  listening_minutes INTEGER DEFAULT 0,
  late_night_listening BOOLEAN DEFAULT false,  -- listening after 11pm
  dominant_mood TEXT,       -- 'energized' | 'calm' | 'melancholic' | 'focused' | 'unknown'
  raw_summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date, provider)
);
ALTER TABLE mood_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_own_mood_metrics" ON mood_metrics
  FOR ALL TO authenticated
  USING (user_id = waldo_user_id());

-- Add YouTube Music to sync schedules
SELECT cron.schedule(
  'waldo-sync-youtube-music',
  '15 3 * * *',  -- 3:15 AM UTC daily (after gmail and tasks)
  $$
  SELECT net.http_post(
    url := (
      SELECT replace(decrypted_secret, '/check-triggers', '/sync-youtube-music')
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

-- Index for mood queries
CREATE INDEX IF NOT EXISTS idx_mood_metrics_user_date ON mood_metrics(user_id, date);
