import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, expect, it } from 'vitest'
import { checkCertificates } from '../server/utils/certificates'
import { openDatabase } from '../server/utils/db'
import { createMonitor } from '../server/utils/monitors'

const DAY = 86_400_000
let db: DatabaseSync
let sent: string[]
const notify = async (t: string) => void sent.push(t)

beforeEach(() => {
  db = openDatabase(':memory:')
  sent = []
})

it('warns once when a certificate enters the warning window', async () => {
  createMonitor(db, { name: 'Shop', type: 'http', target: 'https://shop.example' }, 0)
  const expiry = new Date(30 * DAY)

  await checkCertificates(db, notify, 14, 1 * DAY, async () => expiry)
  expect(sent).toEqual([])
  await checkCertificates(db, notify, 14, 20 * DAY, async () => expiry)
  expect(sent).toEqual(['🔐 <b>Shop</b>: TLS certificate expires in 10 days'])
  await checkCertificates(db, notify, 14, 22 * DAY, async () => expiry)
  expect(sent).toHaveLength(1)
})

it('checks each monitor at most daily and ignores plain http', async () => {
  createMonitor(db, { name: 'Plain', type: 'http', target: 'http://x' }, 0)
  createMonitor(db, { name: 'Tls', type: 'http', target: 'https://x' }, 0)
  let lookups = 0
  const lookup = async () => (lookups++, new Date(400 * DAY))
  await checkCertificates(db, notify, 14, DAY, lookup)
  await checkCertificates(db, notify, 14, DAY + 3_600_000, lookup)
  expect(lookups).toBe(1)
})
