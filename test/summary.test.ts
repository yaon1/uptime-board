import { expect, it } from 'vitest'
import { openDatabase } from '../server/utils/db'
import { createMonitor, recordCheck } from '../server/utils/monitors'
import { latencyHistory, summarize } from '../server/utils/summary'

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

it('reports paused monitors as paused', () => {
  const db = openDatabase(':memory:')
  const m = createMonitor(db, { name: 'site', type: 'http', target: 'https://x' }, 0)
  recordCheck(db, m.id, false, null, 'HTTP 500', 1)
  expect(summarize(db, { ...m, paused: 1 }, 1, 2).status).toBe('paused')
})

it('aggregates hourly latency with p95', () => {
  const db = openDatabase(':memory:')
  const m = createMonitor(db, { name: 'api', type: 'http', target: 'https://x' }, 0)
  const H = 3_600_000
  ;[100, 120, 140, 900].forEach((ms, i) => recordCheck(db, m.id, true, ms, 'HTTP 200', H + i * 60_000))
  recordCheck(db, m.id, false, null, 'Timeout', H + 10 * 60_000)
  recordCheck(db, m.id, true, 50, 'HTTP 200', 2 * H + 1)

  expect(latencyHistory(db, m.id, 3, 2 * H + 5)).toEqual([
    { hour: H, avgMs: 315, p95Ms: 900 },
    { hour: 2 * H, avgMs: 50, p95Ms: 50 },
  ])
})
