import { beforeEach, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../server/utils/db'
import { createMonitor, dueMonitors, findHeartbeat, lastCheck, pruneChecks, recordCheck } from '../server/utils/monitors'

let db: DatabaseSync
beforeEach(() => (db = openDatabase(':memory:')))

it('generates a secret token for heartbeats', () => {
  const hb = createMonitor(db, { name: 'backup', type: 'heartbeat', target: 'ignored' })
  expect(hb.target).toMatch(/^[0-9a-f]{32}$/)
  expect(findHeartbeat(db, hb.target)?.id).toBe(hb.id)
})

it('schedules monitors by interval', () => {
  const m = createMonitor(db, { name: 'site', type: 'http', target: 'https://x', interval_s: 60 })
  expect(dueMonitors(db, 1_000).map((d) => d.id)).toEqual([m.id])

  recordCheck(db, m.id, true, 12, 'HTTP 200', 1_000)
  expect(dueMonitors(db, 30_000)).toEqual([])
  expect(dueMonitors(db, 61_000).map((d) => d.id)).toEqual([m.id])
  expect(lastCheck(db, m.id)).toEqual({ at: 1_000, ok: 1, latency_ms: 12, detail: 'HTTP 200' })
})

it('prunes old checks', () => {
  const m = createMonitor(db, { name: 'site', type: 'http', target: 'https://x' })
  recordCheck(db, m.id, true, 1, '', 1)
  recordCheck(db, m.id, true, 1, '', 100)
  expect(pruneChecks(db, 50)).toBe(1)
})
