import { expect, it } from 'vitest'
import { openDatabase } from '../server/utils/db'
import { createMonitor, recordCheck } from '../server/utils/monitors'
import { summarize } from '../server/utils/summary'

it('computes status, rolling uptime and daily buckets', () => {
  const db = openDatabase(':memory:')
  const m = createMonitor(db, { name: 'site', type: 'http', target: 'https://x' }, 0)
  const now = Date.UTC(2026, 9, 19, 12)
  const day = 86_400_000
  recordCheck(db, m.id, true, 10, 'HTTP 200', now - 2 * day)
  recordCheck(db, m.id, false, null, 'HTTP 500', now - 2 * day + 1000)
  recordCheck(db, m.id, true, 10, 'HTTP 200', now - 1000)
  recordCheck(db, m.id, true, 42, 'HTTP 200', now - 500)

  const s = summarize(db, m, 3, now)
  expect(s).toMatchObject({ status: 'up', latencyMs: 42, uptime24h: 100, uptime30d: 75 })
  expect(s.days).toEqual([
    { day: '2026-10-17', uptime: 50 },
    { day: '2026-10-18', uptime: null },
    { day: '2026-10-19', uptime: 100 },
  ])
})
