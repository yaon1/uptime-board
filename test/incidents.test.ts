import { expect, it } from 'vitest'
import { openDatabase } from '../server/utils/db'
import { incidents } from '../server/utils/incidents'
import { createMonitor, recordCheck } from '../server/utils/monitors'

it('groups consecutive failures into incidents, newest first', () => {
  const db = openDatabase(':memory:')
  const m = createMonitor(db, { name: 'api', type: 'http', target: 'https://x' }, 0)
  const pattern = [1, 0, 0, 1, 1, 0, 1, 0]
  pattern.forEach((ok, i) => recordCheck(db, m.id, Boolean(ok), 1, ok ? 'HTTP 200' : `HTTP 50${i}`, i * 60_000))

  expect(incidents(db, m.id, 0, 8 * 60_000)).toEqual([
    { start: 420_000, end: null, durationMs: 60_000, detail: 'HTTP 507' },
    { start: 300_000, end: 360_000, durationMs: 60_000, detail: 'HTTP 505' },
    { start: 60_000, end: 180_000, durationMs: 120_000, detail: 'HTTP 501' },
  ])
})
