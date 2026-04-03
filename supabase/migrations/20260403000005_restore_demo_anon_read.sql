-- Waldo — Restore anon read for internal demo console
--
-- The multi_user_auth migration (20260402000001) dropped all anon_read_* policies
-- to enforce proper auth. For the INTERNAL demo console (not public-facing),
-- we need anon read back so the console can query data without a JWT session.
--
-- This is intentionally scoped to SELECT only (no anon write).
-- All writes go through Edge Functions using service_role.
-- Safe for internal team use. Revisit before any public launch.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    -- Core health tables
    'users', 'health_snapshots', 'crs_scores', 'stress_events',
    'spots', 'patterns', 'day_activity',
    -- Productivity tables
    'calendar_events', 'calendar_metrics', 'email_metrics',
    'task_metrics', 'master_metrics', 'mood_metrics',
    -- Agent tables
    'conversation_history', 'core_memory', 'agent_logs',
    'agent_evolutions', 'user_intelligence', 'learning_timeline',
    -- Integration tables
    'oauth_tokens', 'sync_log', 'sent_messages'
  ]) LOOP
    -- Drop stale versions first (idempotent)
    EXECUTE format('DROP POLICY IF EXISTS "anon_read_%s" ON %I', tbl, tbl);
    -- Re-create SELECT-only anon policy
    BEGIN
      EXECUTE format(
        'CREATE POLICY "anon_read_%s" ON %I FOR SELECT TO anon USING (true)',
        tbl, tbl
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Also allow anon to read telegram_linking_codes (needed for linking flow)
DROP POLICY IF EXISTS "anon_read_telegram_linking_codes" ON telegram_linking_codes;
CREATE POLICY "anon_read_telegram_linking_codes" ON telegram_linking_codes
  FOR SELECT TO anon USING (true);
