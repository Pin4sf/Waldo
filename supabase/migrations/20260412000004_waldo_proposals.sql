-- waldo_proposals: The Adjustment + The Handoff — Waldo's proposed actions awaiting approval.
-- Waldo writes here via propose_action tool. User approves/rejects via TheHandoff UI.
-- execute-proposal Edge Function reads approved proposals and executes them.

CREATE TABLE IF NOT EXISTS waldo_proposals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,  -- 'calendar_block' | 'calendar_move' | 'task_create' | 'task_defer'
  title        TEXT NOT NULL,  -- "Block 10–11:30am as focus time"
  description  TEXT,           -- longer explanation shown in TheHandoff card
  impact       TEXT,           -- "Protects your peak cognitive window (Form 82)"
  proposed_actions JSONB NOT NULL DEFAULT '[]',
  -- Each action: { action: 'calendar.create'|'calendar.move'|'task.create'|'task.defer', params: {...} }
  status       TEXT NOT NULL DEFAULT 'pending',
  -- pending → approved (→ executing → executed | failed) | rejected | expired
  trace_id     UUID,           -- links to agent_logs
  expires_at   TIMESTAMPTZ DEFAULT (now() + interval '4 hours'),
  resolved_at  TIMESTAMPTZ,
  error_detail TEXT,           -- populated on execution failure
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE waldo_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_proposals"
  ON waldo_proposals FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "anon_read_proposals"
  ON waldo_proposals FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_waldo_proposals_user_status
  ON waldo_proposals(user_id, status, created_at DESC);

-- Auto-expire pending proposals older than 4 hours (via pg_cron, added separately)
-- SELECT cron.schedule('expire-proposals', '*/30 * * * *',
--   $$UPDATE waldo_proposals SET status='expired' WHERE status='pending' AND expires_at < now()$$);
