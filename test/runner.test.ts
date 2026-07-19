import { formatTelegram, type AlertEvent } from '../server/utils/notify'
import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, expect, it } from 'vitest'
import { openDatabase } from '../server/utils/db'
import { createMonitor, recordCheck, updateMonitor } from '../server/utils/monitors'
import { runDueMonitors } from '../server/utils/runner'

let db: DatabaseSync
let sent: string[]
const notify = async (e: AlertEvent) => void sent.push(formatTelegram(e))
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

it('waits for alert_after consecutive failures before alerting', async () => {
  createMonitor(db, { name: 'Flaky', type: 'http', target: 'https://x', interval_s: 60, alert_after: 3 }, 0)
  const outcomes = [false, true, false, false, false, false, true]
  let t = 0
  for (const ok of outcomes) {
    await runDueMonitors(db, notify, async () => ({ ok, latencyMs: 1, detail: ok ? 'HTTP 200' : 'Timeout' }), t)
    t += 60_000
  }
  expect(sent).toEqual(['🔴 <b>Flaky</b> is DOWN\nTimeout', '🟢 <b>Flaky</b> is back UP after 4 min'])
})

it('stays quiet during maintenance windows', async () => {
  const m = createMonitor(db, { name: 'API', type: 'http', target: 'https://x', interval_s: 60 }, 0)
  const { scheduleMaintenance } = await import('../server/utils/maintenance')
  scheduleMaintenance(db, { monitor_id: m.id, starts_at: 0, ends_at: 120_000, note: 'deploy' })
  await runDueMonitors(db, notify, async () => ({ ok: false, latencyMs: null, detail: 'HTTP 503' }), 0)
  await runDueMonitors(db, notify, async () => ({ ok: true, latencyMs: 1, detail: 'HTTP 200' }), 60_000)
  expect(sent).toEqual([])
})

it('does not announce a recovery for an outage that happened during maintenance', async () => {
  const m = createMonitor(db, { name: 'DB', type: 'http', target: 'https://x', interval_s: 60 }, 0)
  const { scheduleMaintenance } = await import('../server/utils/maintenance')
  scheduleMaintenance(db, { monitor_id: m.id, starts_at: 0, ends_at: 60_000, note: 'migration' })
  await runDueMonitors(db, notify, async () => ({ ok: false, latencyMs: null, detail: 'HTTP 503' }), 0)
  await runDueMonitors(db, notify, async () => ({ ok: true, latencyMs: 1, detail: 'HTTP 200' }), 60_000)
  expect(sent).toEqual([])
})

it('records state but sends nothing for muted monitors', async () => {
  const m = createMonitor(db, { name: 'Staging', type: 'http', target: 'https://x', interval_s: 60 }, 0)
  updateMonitor(db, m.id, { muted: true })
  await runDueMonitors(db, notify, async () => ({ ok: false, latencyMs: null, detail: 'HTTP 500' }), 0)
  expect(sent).toEqual([])
  updateMonitor(db, m.id, { muted: false })
  await runDueMonitors(db, notify, async () => ({ ok: false, latencyMs: null, detail: 'HTTP 500' }), 60_000)
  expect(sent).toEqual([])
})
