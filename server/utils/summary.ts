import type { DatabaseSync } from 'node:sqlite'
import { lastCheck, type Monitor } from './monitors'

export interface DayBucket {
  day: string
  /** null when there were no checks that day */
  uptime: number | null
}

export interface MonitorSummary {
  id: number
  name: string
  type: Monitor['type']
  status: 'up' | 'down' | 'pending' | 'paused'
  detail: string | null
  latencyMs: number | null
  uptime24h: number | null
  uptime30d: number | null
  certDaysLeft: number | null
  days: DayBucket[]
}

const DAY = 86_400_000

function uptime(db: DatabaseSync, id: number, since: number): number | null {
  const row = db.prepare('SELECT AVG(ok) AS u FROM checks WHERE monitor_id = ? AND at >= ?').get(id, since) as { u: number | null }
  return row.u === null ? null : Math.round(row.u * 10_000) / 100
}

export function summarize(db: DatabaseSync, monitor: Monitor, days = 90, now = Date.now()): MonitorSummary {
  const start = Math.floor(now / DAY) * DAY - (days - 1) * DAY
  const rows = db
    .prepare('SELECT (at / 86400000) AS d, AVG(ok) AS u FROM checks WHERE monitor_id = ? AND at >= ? GROUP BY d')
    .all(monitor.id, start) as { d: number; u: number }[]
  const byDay = new Map(rows.map((r) => [Math.floor(r.d), r.u]))

  const last = lastCheck(db, monitor.id)
  return {
    id: monitor.id,
    name: monitor.name,
    type: monitor.type,
    status: monitor.paused ? 'paused' : last === undefined ? 'pending' : last.ok ? 'up' : 'down',
    detail: last?.detail ?? null,
    latencyMs: last?.latency_ms ?? null,
    uptime24h: uptime(db, monitor.id, now - DAY),
    uptime30d: uptime(db, monitor.id, now - 30 * DAY),
    certDaysLeft: monitor.cert_expires_at ? Math.floor((monitor.cert_expires_at - now) / DAY) : null,
    days: Array.from({ length: days }, (_, i) => {
      const dayIndex = start / DAY + i
      const u = byDay.get(dayIndex)
      return { day: new Date(dayIndex * DAY).toISOString().slice(0, 10), uptime: u === undefined ? null : Math.round(u * 10_000) / 100 }
    }),
  }
}
