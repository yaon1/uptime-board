import { expect, it } from 'vitest'
import { openDatabase } from '../server/utils/db'

it('applies migrations once and cascades deletes', () => {
  const db = openDatabase(':memory:')
  expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 8 })

  db.prepare(`INSERT INTO monitors (name, type, target, created_at) VALUES ('a', 'http', 'https://x', 0)`).run()
  db.prepare('INSERT INTO checks (monitor_id, at, ok) VALUES (1, 0, 1)').run()
  db.prepare('DELETE FROM monitors WHERE id = 1').run()
  expect(db.prepare('SELECT COUNT(*) AS n FROM checks').get()).toEqual({ n: 0 })
})
