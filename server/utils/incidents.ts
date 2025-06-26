import type { DatabaseSync } from 'node:sqlite'

export interface Incident {
  start: number
  /** null while the monitor is still down */
  end: number | null
  durationMs: number
  detail: string | null
}

/**
 * Derives downtime periods from the raw checks: each run of consecutive failures is
 * one incident. Newest first.
 */
export function incidents(db: DatabaseSync, monitorId: number, since = 0, now = Date.now(), limit = 50): Incident[] {
  const rows = db.prepare('SELECT at, ok, detail FROM checks WHERE monitor_id = ? AND at >= ? ORDER BY at').all(monitorId, since) as {
    at: number
    ok: number
    detail: string | null
  }[]
  const result: Incident[] = []
  let open: Incident | null = null
  for (const row of rows) {
    if (!row.ok && !open) open = { start: row.at, end: null, durationMs: 0, detail: row.detail }
    if (row.ok && open) {
      result.push({ ...open, end: row.at, durationMs: row.at - open.start })
      open = null
    }
  }
  if (open) result.push({ ...open, durationMs: now - open.start })
  return result.reverse().slice(0, limit)
}
