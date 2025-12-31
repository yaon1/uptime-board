import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { openDatabase } from '../server/utils/db'

it('applies migrations once and cascades deletes', () => {
  const db = openDatabase(':memory:')
  expect(db.prepare('PRAGMA user_version').get()).toEqual({ user_version: 13 })

  db.prepare(`INSERT INTO monitors (name, type, target, created_at) VALUES ('a', 'http', 'https://x', 0)`).run()
  db.prepare('INSERT INTO checks (monitor_id, at, ok) VALUES (1, 0, 1)').run()
  db.prepare('DELETE FROM monitors WHERE id = 1').run()
  expect(db.prepare('SELECT COUNT(*) AS n FROM checks').get()).toEqual({ n: 0 })
})

it('migrates an old database so dns monitors can be stored', () => {
  const db = openDatabase(':memory:')
  db.prepare(`INSERT INTO monitors (name, type, target, created_at) VALUES ('mx', 'dns', 'mail.example', 0)`).run()
  expect(db.prepare('SELECT type FROM monitors').get()).toEqual({ type: 'dns' })
})

it('keeps check history when the monitors table is rebuilt', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'ub-')), 'old.sqlite')
  const old = openDatabase(file, 12)
  old.prepare(`INSERT INTO monitors (name, type, target, created_at) VALUES ('web', 'http', 'https://x', 0)`).run()
  old.prepare('INSERT INTO checks (monitor_id, at, ok) VALUES (1, 1, 1)').run()
  old.close()

  const upgraded = openDatabase(file)
  expect(upgraded.prepare('SELECT COUNT(*) AS n FROM checks').get()).toEqual({ n: 1 })
  expect(upgraded.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
})
