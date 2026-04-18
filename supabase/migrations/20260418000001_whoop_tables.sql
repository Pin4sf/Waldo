-- whoop_tables: 5 tables for WHOOP Cloud API ingestion
-- Bonus fields baked in Day 1: skin_temp_celsius, respiratory_rate,
-- sleep_consistency_pct, sport_id/sport_name, physiological day boundaries, max_heart_rate

-- ═══════════════════════════════════════════════════════════════
-- whoop_recovery
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whoop_recovery (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whoop_recovery_id  BIGINT      NOT NULL,
  cycle_id           BIGINT      NOT NULL,
  recovery_score     SMALLINT,                        -- 0–100
  resting_heart_rate REAL,                            -- bpm
  hrv_rmssd_milli    REAL,                            -- RMSSD ms (maps to CRS HRV pillar)
  spo2_percentage    REAL,                            -- %
  skin_temp_celsius  REAL,                            -- °C (illness detection signal)
  user_calibrating   BOOLEAN     DEFAULT false,
  whoop_created_at   TIMESTAMPTZ NOT NULL,
  ingested_at        TIMESTAMPTZ DEFAULT now(),
  raw_payload        JSONB       NOT NULL DEFAULT '{}',
  UNIQUE(user_id, whoop_recovery_id)
);

CREATE INDEX idx_whoop_recovery_user_date ON whoop_recovery(user_id, whoop_created_at DESC);
CREATE INDEX idx_whoop_recovery_payload   ON whoop_recovery USING gin(raw_payload);

ALTER TABLE whoop_recovery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_whoop_recovery"   ON whoop_recovery FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "service_full_whoop_recovery" ON whoop_recovery FOR ALL    USING (current_setting('role') = 'service_role');
CREATE POLICY "anon_read_whoop_recovery"   ON whoop_recovery FOR SELECT TO anon USING (true);

-- ═══════════════════════════════════════════════════════════════
-- whoop_sleep
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whoop_sleep (
  id                             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whoop_sleep_id                 BIGINT      NOT NULL,
  is_nap                         BOOLEAN     DEFAULT false,
  start_time                     TIMESTAMPTZ NOT NULL,
  end_time                       TIMESTAMPTZ NOT NULL,
  total_in_bed_milli             BIGINT,
  total_light_sleep_milli        BIGINT,
  total_slow_wave_milli          BIGINT,
  total_rem_milli                BIGINT,
  disturbance_count              SMALLINT,
  baseline_need_milli            BIGINT,
  need_from_sleep_debt_milli     BIGINT,
  need_from_recent_strain_milli  BIGINT,
  sleep_performance_pct          REAL,                   -- 0–100
  sleep_consistency_pct          REAL,                   -- 0–100 (circadian alignment)
  sleep_efficiency_pct           REAL,                   -- 0–100
  respiratory_rate               REAL,                   -- breaths/min (illness detection 48–72h early)
  whoop_created_at               TIMESTAMPTZ NOT NULL,
  ingested_at                    TIMESTAMPTZ DEFAULT now(),
  raw_payload                    JSONB       NOT NULL DEFAULT '{}',
  UNIQUE(user_id, whoop_sleep_id)
);

CREATE INDEX idx_whoop_sleep_user_date ON whoop_sleep(user_id, start_time DESC);
CREATE INDEX idx_whoop_sleep_payload   ON whoop_sleep USING gin(raw_payload);

ALTER TABLE whoop_sleep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_whoop_sleep"    ON whoop_sleep FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "service_full_whoop_sleep" ON whoop_sleep FOR ALL     USING (current_setting('role') = 'service_role');
CREATE POLICY "anon_read_whoop_sleep"    ON whoop_sleep FOR SELECT TO anon USING (true);

-- ═══════════════════════════════════════════════════════════════
-- whoop_workout
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whoop_workout (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whoop_workout_id    BIGINT      NOT NULL,
  sport_id            INT         NOT NULL,              -- WHOOP sport code (80+ types)
  sport_name          TEXT,                              -- resolved sport name
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  strain              REAL,                              -- 0–21
  avg_heart_rate      REAL,
  max_heart_rate      REAL,
  kilojoules          REAL,
  distance_meter      REAL,
  altitude_gain_meter REAL,
  zone_zero_milli     BIGINT,
  zone_one_milli      BIGINT,
  zone_two_milli      BIGINT,
  zone_three_milli    BIGINT,
  zone_four_milli     BIGINT,
  zone_five_milli     BIGINT,
  whoop_created_at    TIMESTAMPTZ NOT NULL,
  ingested_at         TIMESTAMPTZ DEFAULT now(),
  raw_payload         JSONB       NOT NULL DEFAULT '{}',
  UNIQUE(user_id, whoop_workout_id)
);

CREATE INDEX idx_whoop_workout_user_date ON whoop_workout(user_id, start_time DESC);

ALTER TABLE whoop_workout ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_whoop_workout"    ON whoop_workout FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "service_full_whoop_workout" ON whoop_workout FOR ALL     USING (current_setting('role') = 'service_role');
CREATE POLICY "anon_read_whoop_workout"    ON whoop_workout FOR SELECT TO anon USING (true);

-- ═══════════════════════════════════════════════════════════════
-- whoop_cycle  (physiological day — spans midnight)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whoop_cycle (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whoop_cycle_id   BIGINT      NOT NULL,
  start_time       TIMESTAMPTZ NOT NULL,                 -- physiological day start
  end_time         TIMESTAMPTZ,                          -- NULL while cycle is open
  strain           REAL,                                 -- 0–21 day strain
  kilojoules       REAL,
  avg_heart_rate   REAL,
  max_heart_rate   REAL,
  whoop_created_at TIMESTAMPTZ NOT NULL,
  ingested_at      TIMESTAMPTZ DEFAULT now(),
  raw_payload      JSONB       NOT NULL DEFAULT '{}',
  UNIQUE(user_id, whoop_cycle_id)
);

CREATE INDEX idx_whoop_cycle_user_date ON whoop_cycle(user_id, start_time DESC);

ALTER TABLE whoop_cycle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_whoop_cycle"    ON whoop_cycle FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "service_full_whoop_cycle" ON whoop_cycle FOR ALL     USING (current_setting('role') = 'service_role');
CREATE POLICY "anon_read_whoop_cycle"    ON whoop_cycle FOR SELECT TO anon USING (true);

-- ═══════════════════════════════════════════════════════════════
-- whoop_body_measurement  (single row per user, updated on change)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whoop_body_measurement (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  height_meter     REAL,
  weight_kilogram  REAL,
  max_heart_rate   SMALLINT,                             -- physiological max HR
  ingested_at      TIMESTAMPTZ DEFAULT now(),
  raw_payload      JSONB   NOT NULL DEFAULT '{}'
);

ALTER TABLE whoop_body_measurement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_whoop_body"    ON whoop_body_measurement FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "service_full_whoop_body" ON whoop_body_measurement FOR ALL     USING (current_setting('role') = 'service_role');

-- ═══════════════════════════════════════════════════════════════
-- pg_cron: daily WHOOP reconciliation (backup to real-time webhooks)
-- ═══════════════════════════════════════════════════════════════
SELECT cron.schedule(
  'sync-whoop',
  '30 4 * * *',
  $$SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/sync-whoop',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key')
    ),
    body    := '{}'::jsonb
  )$$
);
