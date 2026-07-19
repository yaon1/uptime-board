import type { DatabaseSync } from 'node:sqlite'
import { inMaintenance } from './maintenance'
import { dueMonitors, lastCheck, recordCheck, type Monitor } from './monitors'
import type { Notifier } from './notify'
import { probeDns, probeHttp, probeTcp, type ProbeResult } from './probe'

export type Prober = (monitor: Monitor) => Promise<ProbeResult>

export const defaultProber: Prober = (m) => {
  if (m.type === 'http') return probeHttp(m.target, m.timeout_ms, { status: m.expect_status, keyword: m.expect_keyword })
  if (m.type === 'tcp') return probeTcp(m.target, m.timeout_ms)
  if (m.type === 'dns') return probeDns(m.target, m.timeout_ms)
  throw new Error('Heartbeats are not probed')
}

function lastFlip(db: DatabaseSync, monitorId: number, ok: number): number | undefined {
  // Start of the current streak: the first check after the last one with the opposite status.
  const row = db
    .prepare(
      `SELECT MIN(at) AS at FROM checks WHERE monitor_id = ? AND at > COALESCE(
         (SELECT MAX(at) FROM checks WHERE monitor_id = ? AND ok != ?), 0)`,
    )
    .get(monitorId, monitorId, ok) as { at: number | null }
  return row.at ?? undefined
}

/** Records a result and notifies when the status flips. */
/**
 * Records a result and notifies when the alert state flips. Alert state is tracked
 * separately from raw checks so a monitor must fail `alert_after` times in a row
 * before anyone is paged, and recovers on the first success.
 */
export async function applyResult(db: DatabaseSync, monitor: Monitor, result: ProbeResult, notify: Notifier, now = Date.now()) {
  recordCheck(db, monitor.id, result.ok, result.latencyMs, result.detail, now)
  // Planned work: keep recording checks for the history, but leave the alert state alone,
  // otherwise a failure inside the window would page "back UP" after it without a "DOWN".
  if (inMaintenance(db, monitor.id, now)) return
  // Muted monitors keep their alert state current, so unmuting doesn't fire stale alerts.
  if (monitor.muted) notify = async () => {}
  const alert = db.prepare('SELECT down, since FROM alerts WHERE monitor_id = ?').get(monitor.id) as
    { down: number; since: number } | undefined

  if (result.ok) {
    if (alert?.down) {
      db.prepare('UPDATE alerts SET down = 0, since = ? WHERE monitor_id = ?').run(now, monitor.id)
      await notify({ kind: 'up', monitor: monitor.name, detail: result.detail, at: now, downtimeMs: now - alert.since })
    }
    return
  }

  if (alert?.down) return
  const recent = db
    .prepare('SELECT ok FROM checks WHERE monitor_id = ? ORDER BY at DESC LIMIT ?')
    .all(monitor.id, monitor.alert_after ?? 1) as { ok: number }[]
  if (recent.length >= (monitor.alert_after ?? 1) && recent.every((c) => !c.ok)) {
    // Downtime starts at the first failure of the streak, not at the alert.
    const firstFailure = lastFlip(db, monitor.id, 0) ?? now
    db.prepare(
      'INSERT INTO alerts (monitor_id, down, since) VALUES (?, 1, ?) ON CONFLICT(monitor_id) DO UPDATE SET down = 1, since = excluded.since',
    ).run(monitor.id, firstFailure)
    await notify({ kind: 'down', monitor: monitor.name, detail: result.detail, at: now })
  }
}

/** Heartbeats that have not pinged within interval + grace are marked down once. */
export async function checkHeartbeats(db: DatabaseSync, notify: Notifier, now = Date.now()) {
  const stale = db
    .prepare(
      `SELECT m.* FROM monitors m
       WHERE m.type = 'heartbeat' AND m.paused = 0
         AND COALESCE((SELECT MAX(at) FROM checks c WHERE c.monitor_id = m.id), m.created_at) + m.interval_s * 1000 + m.timeout_ms <= ?`,
    )
    .all(now) as unknown as Monitor[]
  for (const m of stale) {
    const previous = lastCheck(db, m.id)
    if (previous && !previous.ok) continue
    await applyResult(db, m, { ok: false, latencyMs: null, detail: `No ping for ${m.interval_s}s` }, notify, now)
  }
}

export async function runDueMonitors(db: DatabaseSync, notify: Notifier, probe: Prober = defaultProber, now = Date.now()) {
  const due = dueMonitors(db, now).filter((m) => m.type !== 'heartbeat')
  await Promise.all(due.map(async (m) => applyResult(db, m, await probe(m), notify, now)))
  await checkHeartbeats(db, notify, now)
  return due.length
}
