import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:https'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { certificateExpiry } from '../server/utils/probe'

let server: Server
let port: number

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cert-'))
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      join(dir, 'key.pem'),
      '-out',
      join(dir, 'cert.pem'),
      '-days',
      '10',
      '-subj',
      '/CN=localhost',
    ],
    { stdio: 'ignore' },
  )
  server = createServer({ key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) }, (_, res) => res.end('ok'))
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as AddressInfo).port
})
afterAll(() => server.close())

it('reads the certificate expiry of an https endpoint', async () => {
  const expiry = await certificateExpiry(`https://localhost:${port}/`)
  const days = ((expiry?.getTime() ?? 0) - Date.now()) / 86_400_000
  expect(days).toBeGreaterThan(9)
  expect(days).toBeLessThan(11)
})

it('returns null for http and unreachable hosts', async () => {
  expect(await certificateExpiry('http://localhost/')).toBeNull()
  expect(await certificateExpiry('https://127.0.0.1:1/', 500)).toBeNull()
})
