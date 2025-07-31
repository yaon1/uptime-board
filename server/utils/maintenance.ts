import type { DatabaseSync } from 'node:sqlite'

export interface Maintenance {
  id: number
  /** null = applies to every monitor */
  monitor_id: number | null
  starts_at: number
  ends_at: number
  note: string
}

export function scheduleMaintenance(db: DatabaseSync, input: Omit<Maintenance, 'id'>): Maintenance {
  if (input.ends_at <= input.starts_at) throw new Error('ends_at must be after starts_at')
  const { lastInsertRowid } = db
    .prepare('INSERT INTO maintenance (monitor_id, starts_at, ends_at, note) VALUES (?, ?, ?, ?)')
    .run(input.monitor_id, input.starts_at, input.ends_at, input.note)
  return { id: Number(lastInsertRowid), ...input }
}

export function inMaintenance(db: DatabaseSync, monitorId: number, now = Date.now()): boolean {
  return (
    db
      .prepare('SELECT 1 FROM maintenance WHERE (monitor_id IS NULL OR monitor_id = ?) AND starts_at <= ? AND ends_at > ? LIMIT 1')
      .get(monitorId, now, now) !== undefined
  )
}

/** Current and future windows, soonest first, for the status page. */
export function upcomingMaintenance(db: DatabaseSync, now = Date.now()): Maintenance[] {
  return db.prepare('SELECT * FROM maintenance WHERE ends_at > ? ORDER BY starts_at').all(now) as unknown as Maintenance[]
}

export function cancelMaintenance(db: DatabaseSync, id: number): boolean {
  return db.prepare('DELETE FROM maintenance WHERE id = ?').run(id).changes > 0
}
