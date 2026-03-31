-- pg_cron + pg_net: Schedule check-triggers every 15 minutes
-- Also stores the project URL and anon key in vault for secure access

-- Store function URL in vault (use anon key since functions are deployed with --no-verify-jwt)
SELECT vault.create_secret(
  'https://ogjgbudoedwxebxfgxpa.supabase.co/functions/v1/check-triggers',
  'waldo_check_triggers_url'
);

SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9namdidWRvZWR3eGVieGZneHBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDg0NTgsImV4cCI6MjA5MDUyNDQ1OH0.z2AZE7K8d1irAx3Jm7jziC0MZj3azZgzgGtb9T2LNvc',
  'waldo_anon_key'
);

-- Schedule: every 15 minutes, call check-triggers Edge Function
SELECT cron.schedule(
  'waldo-check-triggers',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'waldo_check_triggers_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'waldo_anon_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
