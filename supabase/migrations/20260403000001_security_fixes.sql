-- Waldo — Security Fixes Migration
-- 1. Drop allow_all_users on users if it survived earlier migrations
-- 2. Fix patterns.confidence column type (TEXT → REAL)
-- 3. Index for daily fetch alert cap query
--
-- Note: pg_cron schedule updates use anon key (Edge Functions authenticate internally).
-- Service_role key is injected at runtime via SUPABASE_SERVICE_ROLE_KEY env var, not vault.

-- ─── Drop stale broad policy ────────────────────────────────────
DROP POLICY IF EXISTS "allow_all_users" ON users;

-- ─── Fix patterns.confidence type mismatch ──────────────────────
-- Was TEXT NOT NULL ('high'/'moderate'/'low'), but code treats it as float.
-- Map text → float, then alter column type.
UPDATE patterns SET confidence =
  CASE confidence
    WHEN 'high'     THEN '0.80'
    WHEN 'moderate' THEN '0.50'
    WHEN 'low'      THEN '0.25'
    ELSE CASE WHEN confidence ~ '^\d+(\.\d+)?$' THEN confidence ELSE '0.50' END
  END
WHERE confidence !~ '^\d+(\.\d+)?$';

ALTER TABLE patterns
  ALTER COLUMN confidence TYPE REAL USING confidence::REAL;

-- ─── Index for daily fetch alert cap query ──────────────────────
CREATE INDEX IF NOT EXISTS idx_sent_messages_user_trigger_date
  ON sent_messages(user_id, trigger_type, created_at);
