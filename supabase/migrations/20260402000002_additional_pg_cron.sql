-- Waldo — Additional pg_cron schedules
-- Baseline updater (4 AM UTC daily)
-- Weekly compaction (Sunday 20:00 UTC)
-- Daily cost reset (midnight UTC)
-- Expire linking codes (hourly)
-- Cleanup sent_messages (3 AM UTC daily)
--
-- NOTE: pg_cron jobs use the anon key (already in vault from migration 20260331000002).
-- Edge Functions themselves authenticate internally with SUPABASE_SERVICE_ROLE_KEY env var.
-- The service_role key does NOT need to be in vault for these jobs to work.

-- ─── Baseline updater: 4 AM UTC daily ────────────────────────
SELECT cron.schedule(
  'waldo-baseline-updater',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT replace(decrypted_secret, '/check-triggers', '/baseline-updater')
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

-- ─── Weekly compaction: Sunday 20:00 UTC ─────────────────────
SELECT cron.schedule(
  'waldo-weekly-compaction',
  '0 20 * * 0',
  $$
  SELECT net.http_post(
    url := (
      SELECT replace(decrypted_secret, '/check-triggers', '/weekly-compaction')
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

-- ─── Daily cost reset: midnight UTC ──────────────────────────
SELECT cron.schedule(
  'waldo-daily-cost-reset',
  '0 0 * * *',
  $$
  UPDATE users
  SET daily_cost_usd = 0, daily_cost_reset_at = CURRENT_DATE
  WHERE active = true;
  $$
);

-- ─── Expire old linking codes: hourly ────────────────────────
SELECT cron.schedule(
  'waldo-expire-linking-codes',
  '0 * * * *',
  $$
  UPDATE telegram_linking_codes
  SET used = true
  WHERE used = false AND expires_at < now();
  $$
);

-- ─── Cleanup old sent_messages (older than 30 days) ──────────
SELECT cron.schedule(
  'waldo-cleanup-sent-messages',
  '0 3 * * *',
  $$
  DELETE FROM sent_messages WHERE created_at < now() - INTERVAL '30 days';
  $$
);
