import { expect, it } from 'vitest'
import { openDatabase } from '../server/utils/db'
import { cancelMaintenance, inMaintenance, scheduleMaintenance, upcomingMaintenance } from '../server/utils/maintenance'
import { createMonitor } from '../server/utils/monitors'

it('applies windows to one monitor or to all', () => {
  const db = openDatabase(':memory:')
  const a = createMonitor(db, { name: 'a', type: 'http', target: 'https://a' }, 0)
  const b = createMonitor(db, { name: 'b', type: 'http', target: 'https://b' }, 0)
  scheduleMaintenance(db, { monitor_id: a.id, starts_at: 100, ends_at: 200, note: 'DB upgrade' })
  const all = scheduleMaintenance(db, { monitor_id: null, starts_at: 500, ends_at: 600, note: 'Network' })

  expect([inMaintenance(db, a.id, 150), inMaintenance(db, b.id, 150)]).toEqual([true, false])
  expect([inMaintenance(db, a.id, 550), inMaintenance(db, b.id, 550), inMaintenance(db, b.id, 600)]).toEqual([true, true, false])
  expect(upcomingMaintenance(db, 300).map((m) => m.note)).toEqual(['Network'])
  expect(cancelMaintenance(db, all.id)).toBe(true)
  expect(() => scheduleMaintenance(db, { monitor_id: null, starts_at: 5, ends_at: 5, note: '' })).toThrow(/after/)
})
