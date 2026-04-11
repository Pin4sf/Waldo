-- waldo_actions: The Patrol — timestamped log of every action Waldo took
-- Populated by invoke-agent (tool calls, deliveries) and check-triggers (fires, suppressions).
-- Read by the dashboard's The Patrol card via fetchDay().

CREATE TABLE IF NOT EXISTS waldo_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  time         TEXT NOT NULL,        -- e.g. "7:02am"
  action       TEXT NOT NULL,        -- what Waldo did (user-readable)
  reason       TEXT NOT NULL DEFAULT '',  -- why (user-readable)
  type         TEXT NOT NULL DEFAULT 'proactive', -- proactive | reactive | learning
  trace_id     UUID,                 -- links to agent_logs.trace_id
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE waldo_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_waldo_actions"
  ON waldo_actions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_waldo_actions_user_date
  ON waldo_actions(user_id, date DESC);

-- Grant anon read for demo (matches existing demo pattern)
CREATE POLICY "anon_read_waldo_actions"
  ON waldo_actions FOR SELECT
  TO anon
  USING (true);
