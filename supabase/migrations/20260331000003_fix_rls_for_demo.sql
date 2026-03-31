-- Fix RLS policies to allow anon access for demo

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
    BEGIN
      EXECUTE format('CREATE POLICY "anon_read_%s" ON %I FOR SELECT TO anon USING (true)', tbl, tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE format('CREATE POLICY "anon_write_%s" ON %I FOR INSERT TO anon WITH CHECK (true)', tbl, tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
