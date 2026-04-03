/**
 * Local SQLite schema (op-sqlite + SQLCipher AES-256).
 *
 * Security rules (NON-NEGOTIABLE):
 * - All health data encrypted at rest via SQLCipher
 * - Raw health values stored as JSON in payload columns only
 * - Column names never contain health values (e.g. no `hrv_rmssd` column)
 * - NEVER use string interpolation with user data in SQL
 */

export const DB_NAME = 'waldo.db';
export const DB_VERSION = 1;

/** All SQL is declared as constants — never construct SQL strings at runtime */
export const DDL = {
  CREATE_TABLES: `
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_snapshots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      health_data_json TEXT NOT NULL,
      crs_json TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_date ON daily_snapshots (date);
    CREATE INDEX IF NOT EXISTS idx_snapshots_synced ON daily_snapshots (synced);

    CREATE TABLE IF NOT EXISTS baselines (
      id INTEGER PRIMARY KEY DEFAULT 1,
      baselines_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS upload_queue (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL REFERENCES daily_snapshots(id),
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at INTEGER,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status ON upload_queue (sync_status);
  `,
} as const;

export const SQL = {
  // Schema version
  INSERT_VERSION: 'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
  GET_VERSION: 'SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1',

  // Snapshots
  UPSERT_SNAPSHOT: `
    INSERT INTO daily_snapshots (id, date, health_data_json, crs_json, synced, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      health_data_json = excluded.health_data_json,
      crs_json = excluded.crs_json,
      updated_at = excluded.updated_at
  `,
  GET_UNSYNCED: `
    SELECT id, date, health_data_json, crs_json, synced, created_at, updated_at
    FROM daily_snapshots
    WHERE synced = 0
    ORDER BY date DESC
    LIMIT ?
  `,
  MARK_SYNCED: `
    UPDATE daily_snapshots SET synced = 1, updated_at = ?
    WHERE id IN (SELECT value FROM json_each(?))
  `,
  GET_RECENT: `
    SELECT id, date, health_data_json, crs_json, synced, created_at, updated_at
    FROM daily_snapshots
    ORDER BY date DESC
    LIMIT ?
  `,
  GET_LATEST: `
    SELECT id, date, health_data_json, crs_json, synced, created_at, updated_at
    FROM daily_snapshots
    ORDER BY date DESC
    LIMIT 1
  `,

  // Baselines
  UPSERT_BASELINES: `
    INSERT INTO baselines (id, baselines_json, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      baselines_json = excluded.baselines_json,
      updated_at = excluded.updated_at
  `,
  GET_BASELINES: 'SELECT baselines_json, updated_at FROM baselines WHERE id = 1',

  // Upload queue
  ENQUEUE: `
    INSERT OR IGNORE INTO upload_queue (id, snapshot_id, sync_status, created_at)
    VALUES (?, ?, 'pending', ?)
  `,
  GET_PENDING_QUEUE: `
    SELECT q.id, q.snapshot_id, q.retry_count
    FROM upload_queue q
    WHERE q.sync_status = 'pending'
    ORDER BY q.created_at ASC
    LIMIT ?
  `,
  UPDATE_QUEUE_STATUS: `
    UPDATE upload_queue
    SET sync_status = ?, retry_count = retry_count + 1, last_attempt_at = ?
    WHERE id = ?
  `,
} as const;
