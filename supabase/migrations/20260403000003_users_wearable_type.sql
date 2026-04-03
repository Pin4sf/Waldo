-- Waldo — Add wearable_type to users table
-- Referenced by user-profile Edge Function on user creation.
-- Also adds calendar_metrics.boundary_violations which sync-google-calendar writes.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS wearable_type TEXT DEFAULT 'unknown';

-- calendar_metrics: add boundary_violations if missing (sync-google-calendar writes this)
ALTER TABLE calendar_metrics
  ADD COLUMN IF NOT EXISTS boundary_violations INTEGER DEFAULT 0;

-- task_metrics: pending_titles is in schema already — just confirm field alignment
-- (No changes needed, schema already has pending_titles JSONB)
