import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const MIGRATIONS = [
  `CREATE TABLE monitors (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL,
     type TEXT NOT NULL CHECK (type IN ('http', 'tcp', 'heartbeat')),
     target TEXT NOT NULL,
     interval_s INTEGER NOT NULL DEFAULT 60,
     timeout_ms INTEGER NOT NULL DEFAULT 10000,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE checks (
     monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
     at INTEGER NOT NULL,
     ok INTEGER NOT NULL,
     latency_ms INTEGER,
     detail TEXT
   )`,
  `CREATE INDEX checks_monitor_at ON checks (monitor_id, at)`,
  `ALTER TABLE monitors ADD COLUMN paused INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE monitors ADD COLUMN expect_status TEXT`,
  `ALTER TABLE monitors ADD COLUMN expect_keyword TEXT`,
  `ALTER TABLE monitors ADD COLUMN alert_after INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE monitors ADD COLUMN cert_expires_at INTEGER`,
  `ALTER TABLE monitors ADD COLUMN cert_checked_at INTEGER`,
  `ALTER TABLE monitors ADD COLUMN cert_warned_for INTEGER`,
  `CREATE TABLE maintenance (
     id INTEGER PRIMARY KEY,
     monitor_id INTEGER REFERENCES monitors(id) ON DELETE CASCADE,
     starts_at INTEGER NOT NULL,
     ends_at INTEGER NOT NULL,
     note TEXT NOT NULL DEFAULT ''
   )`,
  `CREATE TABLE alerts (monitor_id INTEGER PRIMARY KEY REFERENCES monitors(id) ON DELETE CASCADE, down INTEGER NOT NULL, since INTEGER NOT NULL)`,
  // Rebuild monitors without the CHECK on type so new probe types (dns, …) can be stored.
  `CREATE TABLE monitors_new AS SELECT * FROM monitors;
   DROP TABLE monitors;
   CREATE TABLE monitors (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL,
     type TEXT NOT NULL,
     target TEXT NOT NULL,
     interval_s INTEGER NOT NULL DEFAULT 60,
     timeout_ms INTEGER NOT NULL DEFAULT 10000,
     created_at INTEGER NOT NULL,
     paused INTEGER NOT NULL DEFAULT 0,
     expect_status TEXT,
     expect_keyword TEXT,
     alert_after INTEGER NOT NULL DEFAULT 1,
     cert_expires_at INTEGER,
     cert_checked_at INTEGER,
     cert_warned_for INTEGER
   );
   INSERT INTO monitors SELECT id, name, type, target, interval_s, timeout_ms, created_at, paused, expect_status, expect_keyword, alert_after, cert_expires_at, cert_checked_at, cert_warned_for FROM monitors_new;
   DROP TABLE monitors_new`,
]

/**
 * Opens the database and applies pending migrations tracked by PRAGMA user_version.
 * `upTo` exists for tests that need a database at an older schema version.
 */
export function openDatabase(path: string, upTo = MIGRATIONS.length): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number }
  // Foreign keys stay off while migrating: rebuilding a table (DROP + CREATE) would
  // otherwise cascade-delete every row that references it.
  db.exec('PRAGMA foreign_keys = OFF')
  for (let i = version; i < upTo; i++) {
    db.exec(`BEGIN; ${MIGRATIONS[i]}; PRAGMA user_version = ${i + 1}; COMMIT;`)
  }
  db.exec('PRAGMA foreign_keys = ON')
  return db
}

let instance: DatabaseSync | undefined

export function useDatabase(): DatabaseSync {
  instance ??= openDatabase(useRuntimeConfig().databasePath)
  return instance
}
