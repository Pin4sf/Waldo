-- Waldo Demo — Full Schema
-- All tables for health + productivity + agent intelligence
-- RLS enabled on all user-data tables

-- ─── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INTEGER,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  chronotype TEXT, -- early, normal, late
  wake_time_estimate TEXT DEFAULT '07:00',
  telegram_chat_id BIGINT,
  onboarding_profile JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ─── Health Snapshots (daily aggregated health data) ──────────
CREATE TABLE IF NOT EXISTS health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hr_avg REAL,
  hr_min REAL,
  hr_max REAL,
  hr_count INTEGER DEFAULT 0,
  hrv_rmssd REAL,
  hrv_sdnn REAL,
  hrv_count INTEGER DEFAULT 0,
  resting_hr REAL,
  sleep_duration_hours REAL,
  sleep_efficiency REAL,
  sleep_deep_pct REAL,
  sleep_rem_pct REAL,
  sleep_bedtime TEXT,
  sleep_wake_time TEXT,
  sleep_stages JSONB,
  steps INTEGER DEFAULT 0,
  exercise_minutes REAL DEFAULT 0,
  stand_hours REAL,
  active_energy REAL,
  distance_km REAL,
  spo2 REAL,
  respiratory_rate REAL,
  wrist_temp REAL,
  vo2max REAL,
  workouts JSONB DEFAULT '[]',
  weather JSONB, -- {temperatureF, humidity, source}
  aqi INTEGER,
  aqi_label TEXT,
  pm25 REAL,
  avg_noise_db REAL,
  daylight_minutes REAL,
  data_tier TEXT DEFAULT 'sparse', -- rich, partial, sparse, empty
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;

-- ─── CRS Scores ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crs_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  score INTEGER NOT NULL, -- 0-100 or -1 for insufficient data
  zone TEXT NOT NULL, -- peak, moderate, low, nodata
  confidence REAL,
  components_with_data INTEGER,
  sleep_json JSONB, -- {score, factors[], dataAvailable}
  hrv_json JSONB,
  circadian_json JSONB,
  activity_json JSONB,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE crs_scores ENABLE ROW LEVEL SECURITY;

-- ─── Stress Events ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes REAL NOT NULL,
  confidence REAL NOT NULL,
  severity TEXT NOT NULL, -- high, moderate, log
  components JSONB, -- {hrvDrop, hrElevation, duration, activityInverted}
  explanation TEXT,
  during_workout BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE stress_events ENABLE ROW LEVEL SECURITY;

-- ─── Spots (daily observations) ──────────────────────────────
CREATE TABLE IF NOT EXISTS spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT,
  type TEXT NOT NULL, -- health, behavior, environment, insight, alert, learning
  severity TEXT NOT NULL, -- positive, neutral, warning, critical
  title TEXT NOT NULL,
  detail TEXT,
  signals JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;

-- ─── Patterns (cross-day discoveries) ────────────────────────
CREATE TABLE IF NOT EXISTS patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- weekly, correlation, streak, anomaly, recovery
  confidence TEXT NOT NULL, -- high, moderate, low
  summary TEXT NOT NULL,
  evidence_count INTEGER DEFAULT 0,
  first_seen DATE,
  last_seen DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;

-- ─── Day Activity (morning wags, evening reviews, actions) ───
CREATE TABLE IF NOT EXISTS day_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  morning_wag TEXT,
  evening_review TEXT,
  spots_json JSONB DEFAULT '[]',
  actions_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE day_activity ENABLE ROW LEVEL SECURITY;

-- ─── Calendar Events ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes REAL,
  attendee_count INTEGER DEFAULT 0,
  is_recurring BOOLEAN DEFAULT false,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- ─── Calendar Daily Metrics ──────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meeting_load_score REAL DEFAULT 0,
  total_meeting_minutes REAL DEFAULT 0,
  event_count INTEGER DEFAULT 0,
  back_to_back_count INTEGER DEFAULT 0,
  boundary_violations INTEGER DEFAULT 0,
  focus_gaps JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE calendar_metrics ENABLE ROW LEVEL SECURITY;

-- ─── Email Metrics (daily, metadata only) ────────────────────
CREATE TABLE IF NOT EXISTS email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_emails INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  received_count INTEGER DEFAULT 0,
  after_hours_count INTEGER DEFAULT 0,
  after_hours_ratio REAL DEFAULT 0,
  unique_threads INTEGER DEFAULT 0,
  volume_spike REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE email_metrics ENABLE ROW LEVEL SECURITY;

-- ─── Task Metrics (daily snapshot) ───────────────────────────
CREATE TABLE IF NOT EXISTS task_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pending_count INTEGER DEFAULT 0,
  overdue_count INTEGER DEFAULT 0,
  completed_today INTEGER DEFAULT 0,
  velocity REAL DEFAULT 0,
  completion_rate REAL DEFAULT 0,
  pending_titles JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE task_metrics ENABLE ROW LEVEL SECURITY;

-- ─── Master Metrics (cognitive load, burnout, resilience) ────
CREATE TABLE IF NOT EXISTS master_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  cognitive_load JSONB, -- {score, level, components, summary}
  burnout_trajectory JSONB, -- {score, status, components, summary}
  resilience JSONB, -- {score, level, components}
  cross_source_insights JSONB DEFAULT '[]',
  strain JSONB, -- {score, level, zoneMinutes, peakHR, trimp}
  sleep_debt JSONB, -- {debtHours, direction, shortNights, avgSleep}
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE master_metrics ENABLE ROW LEVEL SECURITY;

-- ─── Conversation History ────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user, waldo
  content TEXT NOT NULL,
  mode TEXT, -- morning_wag, fetch_alert, conversational
  channel TEXT DEFAULT 'telegram', -- telegram, web, mobile
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

-- ─── Core Memory (what Waldo remembers about the user) ───────
CREATE TABLE IF NOT EXISTS core_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, key)
);
ALTER TABLE core_memory ENABLE ROW LEVEL SECURITY;

-- ─── Agent Logs (structured traces) ──────────────────────────
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL, -- morning_wag, fetch_alert, user_message
  tools_called JSONB DEFAULT '[]',
  iterations INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cache_hit_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  quality_gates JSONB DEFAULT '[]',
  delivery_status TEXT DEFAULT 'pending', -- sent, fallback, suppressed, failed
  llm_fallback_level INTEGER DEFAULT 1,
  estimated_cost_usd REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- ─── Agent Evolutions (feedback-driven learning) ─────────────
CREATE TABLE IF NOT EXISTS agent_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_type TEXT,
  source TEXT NOT NULL, -- negative_feedback, dismissal, correction, positive_signal
  context TEXT,
  change_type TEXT NOT NULL, -- verbosity, timing, topic_weight, language_style
  change_value JSONB NOT NULL,
  confidence REAL DEFAULT 1.0,
  applied BOOLEAN DEFAULT false,
  reverted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE agent_evolutions ENABLE ROW LEVEL SECURITY;

-- ─── User Intelligence (cross-day profile) ───────────────────
CREATE TABLE IF NOT EXISTS user_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  workout_patterns JSONB,
  sleep_patterns JSONB,
  activity_patterns JSONB,
  crs_patterns JSONB,
  baselines JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE user_intelligence ENABLE ROW LEVEL SECURITY;

-- ─── Learning Timeline ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS learning_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intelligence_score INTEGER DEFAULT 0,
  total_days INTEGER DEFAULT 0,
  total_observations INTEGER DEFAULT 0,
  connected_sources JSONB DEFAULT '[]',
  milestones JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE learning_timeline ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies (service_role bypasses, anon/authenticated scoped) ───
-- For demo: allow all authenticated users to read all data (single user)
-- In production: scope to auth.uid() = user_id

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'health_snapshots', 'crs_scores', 'stress_events',
      'spots', 'patterns', 'day_activity', 'calendar_events',
      'calendar_metrics', 'email_metrics', 'task_metrics',
      'master_metrics', 'conversation_history', 'core_memory',
      'agent_logs', 'agent_evolutions', 'user_intelligence',
      'learning_timeline'
    ])
  LOOP
    -- Allow full access for authenticated users (demo: single user)
    EXECUTE format(
      'CREATE POLICY "allow_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
    -- Allow service_role full access (Edge Functions)
    EXECUTE format(
      'CREATE POLICY "service_%s" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ─── Indexes for common queries ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_health_snapshots_date ON health_snapshots(user_id, date);
CREATE INDEX IF NOT EXISTS idx_crs_scores_date ON crs_scores(user_id, date);
CREATE INDEX IF NOT EXISTS idx_stress_events_date ON stress_events(user_id, date);
CREATE INDEX IF NOT EXISTS idx_spots_date ON spots(user_id, date);
CREATE INDEX IF NOT EXISTS idx_day_activity_date ON day_activity(user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_metrics_date ON calendar_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_email_metrics_date ON email_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_task_metrics_date ON task_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_master_metrics_date ON master_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_conversation_history_user ON conversation_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user ON agent_logs(user_id, created_at);
