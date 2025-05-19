import type { DatabaseSync } from 'node:sqlite'
import { dueMonitors, lastCheck, recordCheck, type Monitor } from './monitors'
import { formatTransition, type Notifier } from './notify'
import { probeHttp, probeTcp, type ProbeResult } from './probe'

export type Prober = (monitor: Monitor) => Promise<ProbeResult>

export const defaultProber: Prober = (m) => {
  if (m.type === 'http') return probeHttp(m.target, m.timeout_ms, { status: m.expect_status, keyword: m.expect_keyword })
  if (m.type === 'tcp') return probeTcp(m.target, m.timeout_ms)
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
export async function applyResult(db: DatabaseSync, monitor: Monitor, result: ProbeResult, notify: Notifier, now = Date.now()) {
  const previous = lastCheck(db, monitor.id)
  const downSince = previous && !previous.ok ? lastFlip(db, monitor.id, 0) : undefined
  recordCheck(db, monitor.id, result.ok, result.latencyMs, result.detail, now)

  const changed = previous === undefined ? !result.ok : Boolean(previous.ok) !== result.ok
  if (changed) await notify(formatTransition(monitor.name, result.ok, result.detail, downSince, now))
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
