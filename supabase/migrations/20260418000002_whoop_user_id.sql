-- Add whoop_user_id to users table for webhook routing.
-- When a WHOOP webhook fires, we need to find the Waldo user
-- who owns that WHOOP account. whoop-backfill stores this after
-- fetching /user/profile/basic at connect time.

ALTER TABLE users ADD COLUMN IF NOT EXISTS whoop_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_whoop_user_id ON users(whoop_user_id)
  WHERE whoop_user_id IS NOT NULL;
