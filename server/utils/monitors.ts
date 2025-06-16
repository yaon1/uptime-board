import { randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'

export type MonitorType = 'http' | 'tcp' | 'heartbeat'

export interface Monitor {
  id: number
  name: string
  type: MonitorType
  /** URL for http, host:port for tcp, secret token for heartbeat. */
  target: string
  interval_s: number
  timeout_ms: number
  created_at: number
  /** 1 while paused: no probes, no alerts, shown as paused on the status page. */
  paused: number
  expect_status: string | null
  expect_keyword: string | null
  /** Consecutive failures needed before alerting; filters out one-off network blips. */
  alert_after: number
  /** Unix ms when the https certificate expires, refreshed daily. */
  cert_expires_at: number | null
  cert_checked_at: number | null
  /** Expiry we already warned about, so each certificate triggers one warning. */
  cert_warned_for: number | null
}

export interface Check {
  at: number
  ok: number
  latency_ms: number | null
  detail: string | null
}

export interface NewMonitor {
  name: string
  type: MonitorType
  target?: string
  interval_s?: number
  timeout_ms?: number
  expect_status?: string | null
  expect_keyword?: string | null
  alert_after?: number
}

export function createMonitor(db: DatabaseSync, input: NewMonitor, now = Date.now()): Monitor {
  const target = input.type === 'heartbeat' ? randomBytes(16).toString('hex') : (input.target ?? '')
  const { lastInsertRowid } = db
    .prepare('INSERT INTO monitors (name, type, target, interval_s, timeout_ms, expect_status, expect_keyword, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(input.name, input.type, target, input.interval_s ?? 60, input.timeout_ms ?? 10_000, input.expect_status ?? null, input.expect_keyword ?? null, now)
  if (input.alert_after !== undefined) db.prepare('UPDATE monitors SET alert_after = ? WHERE id = ?').run(input.alert_after, Number(lastInsertRowid))
  return getMonitor(db, Number(lastInsertRowid))!
}

export function getMonitor(db: DatabaseSync, id: number): Monitor | undefined {
  return db.prepare('SELECT * FROM monitors WHERE id = ?').get(id) as Monitor | undefined
}

export function listMonitors(db: DatabaseSync): Monitor[] {
  return db.prepare('SELECT * FROM monitors ORDER BY name').all() as unknown as Monitor[]
}

export function updateMonitor(db: DatabaseSync, id: number, changes: Partial<NewMonitor> & { paused?: boolean }): Monitor | undefined {
  const columns = Object.entries({
    name: changes.name,
    target: changes.type === 'heartbeat' ? undefined : changes.target,
    interval_s: changes.interval_s,
    timeout_ms: changes.timeout_ms,
    expect_status: changes.expect_status,
    expect_keyword: changes.expect_keyword,
    alert_after: changes.alert_after,
    paused: changes.paused === undefined ? undefined : changes.paused ? 1 : 0,
  }).filter(([, v]) => v !== undefined)
  if (columns.length > 0) {
    db.prepare(`UPDATE monitors SET ${columns.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...columns.map(([, v]) => v as string | number), id)
  }
  return getMonitor(db, id)
}

export function deleteMonitor(db: DatabaseSync, id: number): boolean {
  return db.prepare('DELETE FROM monitors WHERE id = ?').run(id).changes > 0
}

export function recordCheck(db: DatabaseSync, monitorId: number, ok: boolean, latencyMs: number | null, detail: string, at = Date.now()): void {
  db.prepare('INSERT INTO checks (monitor_id, at, ok, latency_ms, detail) VALUES (?, ?, ?, ?, ?)').run(monitorId, at, ok ? 1 : 0, latencyMs, detail)
}

export function lastCheck(db: DatabaseSync, monitorId: number): Check | undefined {
  return db.prepare('SELECT at, ok, latency_ms, detail FROM checks WHERE monitor_id = ? ORDER BY at DESC LIMIT 1').get(monitorId) as
    | Check
    | undefined
}

/** Monitors whose last check is older than their interval (heartbeats are judged separately). */
export function dueMonitors(db: DatabaseSync, now = Date.now()): Monitor[] {
  return db
    .prepare(
      `SELECT m.* FROM monitors m
       LEFT JOIN (SELECT monitor_id, MAX(at) AS last FROM checks GROUP BY monitor_id) c ON c.monitor_id = m.id
       WHERE m.paused = 0 AND (c.last IS NULL OR c.last + m.interval_s * 1000 <= ?)`,
    )
    .all(now) as unknown as Monitor[]
}

export function findHeartbeat(db: DatabaseSync, token: string): Monitor | undefined {
  return db.prepare(`SELECT * FROM monitors WHERE type = 'heartbeat' AND target = ?`).get(token) as Monitor | undefined
}

export function pruneChecks(db: DatabaseSync, olderThan: number): number {
  return Number(db.prepare('DELETE FROM checks WHERE at < ?').run(olderThan).changes)
}
