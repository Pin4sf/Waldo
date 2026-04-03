-- Waldo — OAuth Tokens Migration
-- Stores OAuth tokens for Google Workspace (Calendar, Gmail, Tasks) and Microsoft Graph.
-- Tokens are encrypted at rest via Supabase Vault + AES-256 at the application layer.
-- RLS: users can only see their own tokens. Service_role bypasses for Edge Function syncs.

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,           -- 'google' | 'microsoft'
  scopes TEXT[] NOT NULL DEFAULT '{}',
  access_token TEXT NOT NULL,       -- encrypted via pgcrypto before storage
  refresh_token TEXT,               -- encrypted; null for providers that don't issue refresh tokens
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)         -- one token set per provider per user
);

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users read their own token records (not the token values — those stay server-side)
CREATE POLICY "own_oauth_tokens_select" ON oauth_tokens
  FOR SELECT TO authenticated
  USING (user_id = waldo_user_id());

-- Only service_role can INSERT/UPDATE/DELETE (Edge Functions use service_role)
-- No authenticated insert/update policy — tokens are managed by server-side OAuth flow only

-- ─── Sync log: track last successful sync per provider per table ──
CREATE TABLE IF NOT EXISTS sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,           -- 'google_calendar', 'gmail', 'google_tasks', 'microsoft_calendar'
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'pending', -- 'ok' | 'error' | 'no_token' | 'token_expired'
  last_error TEXT,
  records_synced INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_sync_log_select" ON sync_log
  FOR SELECT TO authenticated
  USING (user_id = waldo_user_id());

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_provider ON oauth_tokens(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_user_provider ON sync_log(user_id, provider);

-- ─── pg_cron: sync all users' calendars every 30 min ─────────
-- (Deactivate if 0 users have connected Google yet — no-op if no tokens)
SELECT cron.schedule(
  'waldo-sync-google-calendar',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT replace(decrypted_secret, '/check-triggers', '/sync-google-calendar')
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

-- ─── pg_cron: sync Gmail + Tasks nightly at 3:30 AM UTC ──────
SELECT cron.schedule(
  'waldo-sync-gmail',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT replace(decrypted_secret, '/check-triggers', '/sync-gmail')
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

SELECT cron.schedule(
  'waldo-sync-tasks',
  '45 3 * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT replace(decrypted_secret, '/check-triggers', '/sync-tasks')
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
