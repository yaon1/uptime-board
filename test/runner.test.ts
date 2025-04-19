import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, expect, it } from 'vitest'
import { openDatabase } from '../server/utils/db'
import { createMonitor, recordCheck, updateMonitor } from '../server/utils/monitors'
import { runDueMonitors } from '../server/utils/runner'

let db: DatabaseSync
let sent: string[]
const notify = async (t: string) => void sent.push(t)
beforeEach(() => {
  db = openDatabase(':memory:')
  sent = []
})

it('notifies only on status flips, with downtime duration', async () => {
  createMonitor(db, { name: 'API', type: 'http', target: 'https://x', interval_s: 60 }, 0)
  const results = [true, false, false, true]
  let t = 0
  for (const ok of results) {
    await runDueMonitors(db, notify, async () => ({ ok, latencyMs: 5, detail: ok ? 'HTTP 200' : 'HTTP 502' }), t)
    t += 60_000
  }
  expect(sent).toEqual(['🔴 <b>API</b> is DOWN\nHTTP 502', '🟢 <b>API</b> is back UP after 2 min'])
})

it('marks silent heartbeats down once and recovers on ping', async () => {
  const hb = createMonitor(db, { name: 'cron', type: 'heartbeat', interval_s: 300, timeout_ms: 60_000 }, 0)
  await runDueMonitors(db, notify, undefined, 200_000)
  expect(sent).toEqual([])
  await runDueMonitors(db, notify, undefined, 400_000)
  await runDueMonitors(db, notify, undefined, 460_000)
  expect(sent).toEqual(['🔴 <b>cron</b> is DOWN\nNo ping for 300s'])
  recordCheck(db, hb.id, true, null, 'ping', 500_000)
  await runDueMonitors(db, notify, undefined, 520_000)
  expect(sent).toHaveLength(1)
})

it('does not alert on paused heartbeats', async () => {
  const hb = createMonitor(db, { name: 'cron', type: 'heartbeat', interval_s: 60, timeout_ms: 1000 }, 0)
  updateMonitor(db, hb.id, { paused: true })
  await runDueMonitors(db, notify, undefined, 1_000_000)
  expect(sent).toEqual([])
})
