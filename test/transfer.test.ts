import { expect, it } from 'vitest'
import { openDatabase } from '../server/utils/db'
import { createMonitor, listMonitors } from '../server/utils/monitors'
import { exportMonitors, importMonitors } from '../server/utils/transfer'

it('round-trips monitors and regenerates heartbeat tokens', () => {
  const source = openDatabase(':memory:')
  createMonitor(source, { name: 'Web', type: 'http', target: 'https://x.dev', expect_keyword: 'OK', alert_after: 2 })
  const hb = createMonitor(source, { name: 'Backup', type: 'heartbeat', interval_s: 86_400 })

  const file = exportMonitors(source)
  expect(file.monitors.find((m) => m.name === 'Backup')?.target).toBeUndefined()

  const target = openDatabase(':memory:')
  expect(importMonitors(target, JSON.parse(JSON.stringify(file)))).toEqual({ created: 2, skipped: [] })
  const imported = listMonitors(target)
  expect(imported.find((m) => m.name === 'Web')).toMatchObject({ expect_keyword: 'OK', alert_after: 2 })
  expect(imported.find((m) => m.name === 'Backup')?.target).not.toBe(hb.target)

  expect(importMonitors(target, file)).toEqual({ created: 0, skipped: ['Backup', 'Web'] })
})

it('rejects the whole file when one monitor is invalid', () => {
  const db = openDatabase(':memory:')
  expect(() => importMonitors(db, { version: 1, monitors: [{ name: 'ok', type: 'heartbeat' }, { name: 'bad', type: 'http', target: 'nope' }] })).toThrow(
    'monitor #2: http target must be a URL',
  )
  expect(listMonitors(db)).toEqual([])
})
