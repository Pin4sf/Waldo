/**
 * Waldo DO SQLite — 5-tier memory schema, operations, and compaction.
 *
 * Architecture (AtlanClaw-validated pattern, April 2026):
 *
 * READ-ONLY (identity — set by provision, never overwritten by agent):
 *   memory_blocks WHERE category = 'identity'
 *     → user_id, user_name, timezone, wake_time, wearable_type
 *     → Equivalent to IDENTITY.md / ConfigMap
 *
 * WRITABLE (agent memory — evolves per conversation):
 *   memory_blocks WHERE category IN ('health', 'preference', 'pattern', 'episodic')
 *     → health: baselines, current state (set by patrol, never by user input)
 *     → preference: user-expressed preferences (validated before write)
 *     → pattern: promoted patterns from compaction (high confidence)
 *     → episodic: daily diary entries from compaction (diary_YYYY-MM-DD)
 *     → Equivalent to MEMORY.md / PVC
 *
 * RAW LOG (daily accumulation, compacted nightly):
 *   episodes table
 *     → Every conversation turn, Morning Wag, Fetch Alert, observation
 *     → Equivalent to memory/YYYY-MM-DD.md
 *     → consolidated = 1 after daily compaction
 *     → archived_to_r2 = 1 after 90 days (Phase E)
 *
 * BEHAVIORAL PARAMETERS (Phase G):
 *   procedures table
 *     → Learned from feedback signals
 *     → Equivalent to skills/ (writable, self-generated, validated)
 *
 * SCHEDULING STATE:
 *   agent_state table
 *     → Cooldowns, daily counts, compaction dates, cost tracking
 */

// ─── Type helpers ─────────────────────────────────────────────────

export type SqlStorage = DurableObjectStorage['sql'];

// ─── INJECTION DETECTION ──────────────────────────────────────────
// Applied before any user-supplied content enters memory_blocks.
// Catches prompt injection, code injection, and memory poisoning.

const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above|prior)\s+instructions?/i,
  /you\s+are\s+now\s+/i,
  /system\s*:/i,
  /assistant\s*:/i,
  /\bsudo\b/i,
  /<script[\s>]/i,
  /javascript\s*:/i,
  /base64\s*,/i,
  /data\s*:\s*text/i,
  // Structural injection — URL/code in memory values
  /https?:\/\//i,
  /```[\s\S]{0,20}```/,
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
];

/**
 * Sanitize a value before writing to memory_blocks.
 * - Truncates to 600 chars
 * - Returns null if injection patterns detected (caller should skip write)
 * - Strips leading/trailing whitespace and control characters
 */
export function sanitizeMemoryValue(value: string): string | null {
  const cleaned = value.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, 600);
  if (INJECTION_PATTERNS.some(p => p.test(cleaned))) {
    console.warn('[Memory] Rejected write — injection pattern detected');
    return null;
  }
  return cleaned || null;
}

/** Keys that belong to the identity category — NEVER overwritten by agent or user input. */
const IDENTITY_KEYS = new Set([
  'user_id', 'user_name', 'timezone', 'wake_time', 'evening_time',
  'wearable_type', 'interview_step', 'interview_complete',
]);

// ─── Schema ───────────────────────────────────────────────────────

export function initSchema(sql: SqlStorage): void {
  sql.exec(`
    -- Tier 1 + episodic: Semantic + diary memory (always or on-demand)
    -- category = 'identity'   → read-only (set by provision, never by agent/user)
    -- category = 'health'     → set by patrol (baselines, current state)
    -- category = 'preference' → agent-writable, user-expressed prefs (validated)
    -- category = 'pattern'    → promoted high-confidence patterns from compaction
    -- category = 'episodic'   → daily diary entries: diary_YYYY-MM-DD
    CREATE TABLE IF NOT EXISTS memory_blocks (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      category    TEXT DEFAULT 'general',
      source_type TEXT DEFAULT 'auto_derived',  -- 'auto_derived' | 'user_validated' | 'conversation_insight' (Karpathy/JieqLuo tier distinction)
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    -- Tier 2: Raw daily event log (conversation turns, proactive messages, observations)
    -- consolidated = 1 → included in a daily diary entry (safe to archive)
    CREATE TABLE IF NOT EXISTS episodes (
      id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      type           TEXT NOT NULL,    -- 'morning_wag' | 'fetch_alert' | 'conversation' | 'observation' | 'interview' | 'evening_review'
      role           TEXT,             -- 'user' | 'waldo' (for conversation/interview episodes)
      content        TEXT NOT NULL,
      metadata       TEXT DEFAULT '{}',
      created_at     TEXT DEFAULT (datetime('now')),
      consolidated   INTEGER DEFAULT 0,  -- 1 = included in daily diary entry
      archived_to_r2 INTEGER DEFAULT 0,
      r2_key         TEXT
    );

    -- Tier 3: Behavioral parameters — Phase G (learned from feedback signals)
    CREATE TABLE IF NOT EXISTS procedures (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      change_type  TEXT NOT NULL,    -- 'verbosity' | 'timing' | 'topic_weight' | 'language_style'
      change_value TEXT NOT NULL,    -- JSON
      source       TEXT NOT NULL,    -- 'feedback' | 'dismissal' | 'correction' | 'positive_signal'
      confidence   REAL DEFAULT 1.0,
      applied      INTEGER DEFAULT 0,
      reverted     INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- Scheduling + operational state (cooldowns, daily counters, compaction tracking)
    CREATE TABLE IF NOT EXISTS agent_state (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate: add `consolidated` column if upgrading from older schema
  try {
    sql.exec('ALTER TABLE episodes ADD COLUMN consolidated INTEGER DEFAULT 0');
  } catch {
    // Column already exists — safe to ignore
  }
}

// ─── memory_blocks (Tier 1 + episodic) ───────────────────────────

export function readMemory(sql: SqlStorage, key: string): string | null {
  const rows = sql.exec('SELECT value FROM memory_blocks WHERE key = ?', key).toArray();
  return rows[0]?.['value'] as string ?? null;
}

/**
 * Write to memory_blocks.
 * - IDENTITY keys: only writable via provision (caller must set isProvision=true)
 * - All other writes: validated against injection patterns
 * - Returns false if write was rejected (poisoning detected or identity violation)
 */
export function writeMemory(
  sql: SqlStorage,
  key: string,
  value: string,
  category = 'general',
  isProvision = false,
): boolean {
  // Block agent/user from overwriting identity keys
  if (IDENTITY_KEYS.has(key) && !isProvision) {
    console.warn(`[Memory] Blocked identity overwrite attempt: ${key}`);
    return false;
  }

  // Validate user-supplied content categories
  const userSupplied = ['preference', 'profile'].includes(category);
  if (userSupplied) {
    const safe = sanitizeMemoryValue(value);
    if (safe === null) return false;
    sql.exec(
      `INSERT OR REPLACE INTO memory_blocks (key, value, category, updated_at)
       VALUES (?, ?, ?, datetime('now'))`,
      key, safe, category,
    );
    return true;
  }

  // Health/pattern/episodic/general — no injection check (set by system, not user)
  sql.exec(
    `INSERT OR REPLACE INTO memory_blocks (key, value, category, updated_at)
     VALUES (?, ?, ?, datetime('now'))`,
    key, value, category,
  );
  return true;
}

/** Load all memory blocks into a key-value map. */
export function loadCoreMemory(sql: SqlStorage): Record<string, string> {
  const rows = sql.exec('SELECT key, value FROM memory_blocks').toArray();
  return Object.fromEntries(rows.map(r => [r['key'] as string, r['value'] as string]));
}

/** Load only identity + health + recent pattern keys (<200 tokens). */
export function loadCompactMemory(sql: SqlStorage): Record<string, string> {
  const rows = sql.exec(
    `SELECT key, value FROM memory_blocks
     WHERE category IN ('identity', 'health', 'pattern')
        OR key IN ('last_weekly_summary', 'chronotype', 'sleep_debt')
     ORDER BY updated_at DESC`,
  ).toArray();
  return Object.fromEntries(rows.map(r => [r['key'] as string, r['value'] as string]));
}

/** Load interview profile answers (stored with category='profile'). */
export function loadProfileMemory(sql: SqlStorage): Record<string, string> {
  const rows = sql.exec(
    `SELECT key, value FROM memory_blocks
     WHERE category = 'profile'`,
  ).toArray();
  return Object.fromEntries(rows.map(r => [r['key'] as string, r['value'] as string]));
}

/** Load the most recent N daily diary entries (category='episodic', key='diary_YYYY-MM-DD'). */
export function loadRecentDiaries(sql: SqlStorage, limit = 3): string[] {
  const rows = sql.exec(
    `SELECT value FROM memory_blocks
     WHERE category = 'episodic' AND key LIKE 'diary_%'
     ORDER BY key DESC LIMIT ?`,
    limit,
  ).toArray();
  return rows.map(r => r['value'] as string);
}

// ─── episodes (Tier 2 — raw daily log) ───────────────────────────

export function addEpisode(
  sql: SqlStorage,
  type: string,
  content: string,
  role?: string,
  metadata?: Record<string, unknown>,
): void {
  sql.exec(
    `INSERT INTO episodes (type, role, content, metadata) VALUES (?, ?, ?, ?)`,
    type, role ?? null, content, JSON.stringify(metadata ?? {}),
  );
}

export function getRecentEpisodes(
  sql: SqlStorage,
  limit = 20,
  type?: string,
): Array<{ type: string; role: string | null; content: string; created_at: string }> {
  const query = type
    ? `SELECT type, role, content, created_at FROM episodes WHERE type = ? AND archived_to_r2 = 0 ORDER BY created_at DESC LIMIT ?`
    : `SELECT type, role, content, created_at FROM episodes WHERE archived_to_r2 = 0 ORDER BY created_at DESC LIMIT ?`;
  const params = type ? [type, limit] : [limit];
  return sql.exec(query, ...params).toArray() as Array<{ type: string; role: string | null; content: string; created_at: string }>;
}

export function getConversationHistory(sql: SqlStorage, limit = 10): Array<{ role: string; content: string }> {
  const rows = sql.exec(
    `SELECT role, content FROM episodes WHERE type = 'conversation' AND archived_to_r2 = 0 ORDER BY created_at DESC LIMIT ?`,
    limit,
  ).toArray() as Array<{ role: string; content: string }>;
  return rows.reverse();
}

/** Get unconsolidated episodes for a specific date (for daily compaction). */
export function getUnconsolidatedEpisodes(
  sql: SqlStorage,
  dateStr: string,  // 'YYYY-MM-DD'
): Array<{ type: string; role: string | null; content: string; created_at: string }> {
  return sql.exec(
    `SELECT type, role, content, created_at FROM episodes
     WHERE consolidated = 0
       AND archived_to_r2 = 0
       AND date(created_at) = ?
     ORDER BY created_at ASC`,
    dateStr,
  ).toArray() as Array<{ type: string; role: string | null; content: string; created_at: string }>;
}

/** Mark all episodes for a date as consolidated (included in daily diary). */
export function markEpisodesConsolidated(sql: SqlStorage, dateStr: string): void {
  sql.exec(
    `UPDATE episodes SET consolidated = 1 WHERE date(created_at) = ? AND consolidated = 0`,
    dateStr,
  );
}

// ─── agent_state (scheduling, cooldowns, compaction tracking) ─────

export function getState(sql: SqlStorage, key: string): string | null {
  const rows = sql.exec('SELECT value FROM agent_state WHERE key = ?', key).toArray();
  return rows[0]?.['value'] as string ?? null;
}

export function setState(sql: SqlStorage, key: string, value: string): void {
  sql.exec(
    `INSERT OR REPLACE INTO agent_state (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    key, value,
  );
}

// ─── Idempotency helpers ──────────────────────────────────────────

export function wasRecentlySent(sql: SqlStorage, triggerType: string, windowMs: number): boolean {
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `sent:${triggerType}:${bucket}`;
  const rows = sql.exec('SELECT value FROM agent_state WHERE key = ?', key).toArray();
  return rows.length > 0;
}

export function markSent(sql: SqlStorage, triggerType: string, windowMs: number): void {
  const bucket = Math.floor(Date.now() / windowMs);
  const key = `sent:${triggerType}:${bucket}`;
  sql.exec(`INSERT OR REPLACE INTO agent_state (key, value) VALUES (?, datetime('now'))`, key);
}

export function countTodaySent(sql: SqlStorage, triggerType: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const rows = sql.exec(
    `SELECT COUNT(*) as cnt FROM agent_state WHERE key LIKE ? AND updated_at >= ?`,
    `sent:${triggerType}:%`, `${today}T00:00:00`,
  ).toArray();
  return rows[0]?.['cnt'] as number ?? 0;
}
