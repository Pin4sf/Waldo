-- Waldo — Multi-User Auth Migration
-- Adds Supabase Auth integration, Telegram linking, idempotency, proper RLS.
-- Preserves existing Ark demo data (id = 00000000-0000-0000-0000-000000000001).

-- ─── Extend users table ───────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS preferred_evening_time TEXT DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS last_health_sync TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS daily_cost_usd REAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_cost_reset_at DATE;

-- Mark Ark as onboarded (existing demo data)
UPDATE users SET onboarding_complete = true, active = true
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ─── Helper function for RLS (avoids subquery repetition) ─────
CREATE OR REPLACE FUNCTION waldo_user_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$;

-- ─── Telegram linking codes (6-digit, 10-min expiry) ─────────
CREATE TABLE IF NOT EXISTS telegram_linking_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code)
);
ALTER TABLE telegram_linking_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_codes" ON telegram_linking_codes
  FOR ALL TO authenticated
  USING (user_id = waldo_user_id())
  WITH CHECK (user_id = waldo_user_id());

-- ─── Sent messages (idempotency tracking) ─────────────────────
CREATE TABLE IF NOT EXISTS sent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  trigger_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_sent_messages" ON sent_messages
  FOR SELECT TO authenticated
  USING (user_id = waldo_user_id());

-- ─── Replace anon demo RLS with authenticated user policies ───
-- This drops the wide-open anon policies and adds proper auth-scoped ones.
-- Edge Functions continue to use service_role key (bypasses RLS entirely).

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'health_snapshots', 'crs_scores', 'stress_events', 'spots', 'patterns',
    'day_activity', 'calendar_events', 'calendar_metrics', 'email_metrics',
    'task_metrics', 'master_metrics', 'conversation_history', 'core_memory',
    'agent_logs', 'agent_evolutions', 'user_intelligence', 'learning_timeline'
  ]) LOOP
    -- Drop demo anon policies
    EXECUTE format('DROP POLICY IF EXISTS "anon_read_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "anon_write_%s" ON %I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON %I', tbl, tbl);

    -- Authenticated users: read/write own data only
    BEGIN
      EXECUTE format(
        'CREATE POLICY "auth_own_%s" ON %I TO authenticated USING (user_id = waldo_user_id())',
        tbl, tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE format(
        'CREATE POLICY "auth_insert_%s" ON %I FOR INSERT TO authenticated WITH CHECK (user_id = waldo_user_id())',
        tbl, tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Users table: own row access via auth_id
DROP POLICY IF EXISTS "anon_read_users" ON users;
DROP POLICY IF EXISTS "anon_write_users" ON users;
DROP POLICY IF EXISTS "allow_all_users" ON users;

CREATE POLICY "auth_own_users_select" ON users
  FOR SELECT TO authenticated
  USING (auth_id = auth.uid());

CREATE POLICY "auth_own_users_insert" ON users
  FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "auth_own_users_update" ON users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid());

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_sent_messages_key ON sent_messages(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_linking_codes_code ON telegram_linking_codes(code) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_linking_codes_expires ON telegram_linking_codes(expires_at) WHERE used = false;
