import type { DatabaseSync } from 'node:sqlite'
import { createMonitor, listMonitors, type NewMonitor } from './monitors'
import { validateMonitor } from './validate'

export interface ExportFile {
  version: 1
  monitors: (NewMonitor & { paused: boolean })[]
}

/** Monitor definitions only (no check history), e.g. to move to a new server or keep in git. */
export function exportMonitors(db: DatabaseSync): ExportFile {
  return {
    version: 1,
    monitors: listMonitors(db).map((m) => ({
      name: m.name,
      type: m.type,
      // Heartbeat tokens are secrets and get regenerated on import.
      target: m.type === 'heartbeat' ? undefined : m.target,
      interval_s: m.interval_s,
      timeout_ms: m.timeout_ms,
      expect_status: m.expect_status,
      expect_keyword: m.expect_keyword,
      alert_after: m.alert_after,
      group_name: m.group_name,
      paused: Boolean(m.paused),
    })),
  }
}

/** Validates everything first, then inserts in one transaction: all or nothing. Skips names that exist. */
export function importMonitors(db: DatabaseSync, file: unknown): { created: number; skipped: string[] } {
  const data = file as Partial<ExportFile>
  if (data?.version !== 1 || !Array.isArray(data.monitors)) throw new Error('Expected an export file with version 1')
  const inputs = data.monitors.map((m, i) => {
    try {
      return validateMonitor(m as unknown as Record<string, unknown>) as NewMonitor
    } catch (e) {
      throw new Error(`monitor #${i + 1}: ${(e as Error).message}`, { cause: e })
    }
  })
  const existing = new Set(listMonitors(db).map((m) => m.name))
  const skipped: string[] = []
  let created = 0
  db.exec('BEGIN')
  try {
    for (const input of inputs) {
      if (existing.has(input.name)) {
        skipped.push(input.name)
        continue
      }
      createMonitor(db, input)
      created++
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  return { created, skipped }
}
