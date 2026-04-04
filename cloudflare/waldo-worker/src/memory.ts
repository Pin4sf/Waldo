/**
 * Waldo DO SQLite — 5-tier memory schema and operations.
 *
 * Tier 1: memory_blocks — always loaded, <200 tokens (identity, baselines, preferences)
 * Tier 2: episodes     — on-demand, last 90 days (conversation history, observations)
 * Tier 3: procedures   — selectively loaded (evolution entries, Phase G)
 *
 * Health values (HRV ms, sleep hours, HR) NEVER stored here.
 * Only derived insights: "HRV declining", "sleep debt accumulating".
 */

export type SqlStorage = ReturnType<DurableObjectState['storage']['sql']> extends never
  ? { exec: (sql: string, ...params: unknown[]) => { toArray: () => Record<string, unknown>[] } }
  : ReturnType<DurableObjectState['storage']>['sql'];

export function initSchema(sql: DurableObjectStorage['sql']): void {
  sql.exec(`
    -- Tier 1: Semantic memory (always in context)
    CREATE TABLE IF NOT EXISTS memory_blocks (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      category TEXT DEFAULT 'general',  -- 'identity' | 'health' | 'preference' | 'calibration'
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Tier 2: Episodic memory (conversation history, daily observations)
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      type TEXT NOT NULL,          -- 'morning_wag' | 'fetch_alert' | 'conversation' | 'observation'
      role TEXT,                   -- 'user' | 'waldo' (for conversation episodes)
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',  -- JSON: trigger_type, tokens, cost, zone
      created_at TEXT DEFAULT (datetime('now')),
      archived_to_r2 INTEGER DEFAULT 0,
      r2_key TEXT
    );

    -- Tier 3: Procedural memory (behavioral parameters — Phase G)
    CREATE TABLE IF NOT EXISTS procedures (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      change_type TEXT NOT NULL,   -- 'verbosity' | 'timing' | 'topic_weight'
      change_value TEXT NOT NULL,  -- JSON
      source TEXT NOT NULL,        -- 'feedback' | 'dismissal' | 'correction'
      confidence REAL DEFAULT 1.0,
      applied INTEGER DEFAULT 0,
      reverted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Agent state (scheduling, cooldowns, daily counts)
    CREATE TABLE IF NOT EXISTS agent_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ─── memory_blocks (Tier 1) ───────────────────────────────────────

export function readMemory(sql: DurableObjectStorage['sql'], key: string): string | null {
  const rows = sql.exec('SELECT value FROM memory_blocks WHERE key = ?', key).toArray();
  return rows[0]?.['value'] as string ?? null;
}

export function writeMemory(sql: DurableObjectStorage['sql'], key: string, value: string, category = 'general'): void {
  sql.exec(
    `INSERT OR REPLACE INTO memory_blocks (key, value, category, updated_at)
     VALUES (?, ?, ?, datetime('now'))`,
    key, value, category,
  );
}

export function loadCoreMemory(sql: DurableObjectStorage['sql']): Record<string, string> {
  const rows = sql.exec('SELECT key, value FROM memory_blocks').toArray();
  return Object.fromEntries(rows.map(r => [r['key'] as string, r['value'] as string]));
}

// ─── episodes (Tier 2) ────────────────────────────────────────────

export function addEpisode(sql: DurableObjectStorage['sql'], type: string, content: string, role?: string, metadata?: Record<string, unknown>): void {
  sql.exec(
    `INSERT INTO episodes (type, role, content, metadata) VALUES (?, ?, ?, ?)`,
    type, role ?? null, content, JSON.stringify(metadata ?? {}),
  );
}

export function getRecentEpisodes(sql: DurableObjectStorage['sql'], limit = 20, type?: string): Array<{ type: string; role: string | null; content: string; created_at: string }> {
  const query = type
    ? `SELECT type, role, content, created_at FROM episodes WHERE type = ? AND archived_to_r2 = 0 ORDER BY created_at DESC LIMIT ?`
    : `SELECT type, role, content, created_at FROM episodes WHERE archived_to_r2 = 0 ORDER BY created_at DESC LIMIT ?`;
  const params = type ? [type, limit] : [limit];
  return sql.exec(query, ...params).toArray() as Array<{ type: string; role: string | null; content: string; created_at: string }>;
}

export function getConversationHistory(sql: DurableObjectStorage['sql'], limit = 10): Array<{ role: string; content: string }> {
  const rows = sql.exec(
    `SELECT role, content FROM episodes WHERE type = 'conversation' AND archived_to_r2 = 0 ORDER BY created_at DESC LIMIT ?`,
    limit,
  ).toArray() as Array<{ role: string; content: string }>;
  return rows.reverse();
}

// ─── agent_state (scheduling, cooldowns) ─────────────────────────

export function getState(sql: DurableObjectStorage['sql'], key: string): string | null {
  const rows = sql.exec('SELECT value FROM agent_state WHERE key = ?', key).toArray();
  return rows[0]?.['value'] as string ?? null;
}

export function setState(sql: DurableObjectStorage['sql'], key: string, value: string): void {
  sql.exec(
    `INSERT OR REPLACE INTO agent_state (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    key, value,
  );
}

// ─── Idempotency ──────────────────────────────────────────────────

export function wasRecentlySent(sql: DurableObjectStorage['sql'], triggerType: string, windowMs: number): boolean {
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `sent:${triggerType}:${bucket}`;
  const rows = sql.exec('SELECT value FROM agent_state WHERE key = ?', key).toArray();
  return rows.length > 0;
}

export function markSent(sql: DurableObjectStorage['sql'], triggerType: string, windowMs: number): void {
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `sent:${triggerType}:${bucket}`;
  sql.exec(`INSERT OR REPLACE INTO agent_state (key, value) VALUES (?, datetime('now'))`, key);
}

export function countTodaySent(sql: DurableObjectStorage['sql'], triggerType: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const rows = sql.exec(
    `SELECT COUNT(*) as cnt FROM agent_state WHERE key LIKE ? AND updated_at >= ?`,
    `sent:${triggerType}:%`, `${today}T00:00:00`,
  ).toArray();
  return rows[0]?.['cnt'] as number ?? 0;
}
