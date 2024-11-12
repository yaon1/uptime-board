import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { probeHttp, probeTcp } from '../server/utils/probe'

let server: Server
let port: number

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/slow') return void setTimeout(() => res.end('late'), 500)
    res.statusCode = req.url === '/down' ? 503 : 200
    res.end('ok')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  port = (server.address() as AddressInfo).port
})
afterAll(() => server.close())

describe('probeHttp', () => {
  it('passes on 2xx', async () => {
    expect(await probeHttp(`http://127.0.0.1:${port}/`, 1000)).toMatchObject({ ok: true, detail: 'HTTP 200' })
  })
  it('fails on 5xx', async () => {
    expect(await probeHttp(`http://127.0.0.1:${port}/down`, 1000)).toMatchObject({ ok: false, detail: 'HTTP 503' })
  })
  it('fails on timeout', async () => {
    expect(await probeHttp(`http://127.0.0.1:${port}/slow`, 100)).toMatchObject({ ok: false, detail: 'Timeout' })
  })
})

describe('probeTcp', () => {
  it('connects to an open port', async () => {
    expect((await probeTcp(`127.0.0.1:${port}`, 1000)).ok).toBe(true)
  })
  it('reports refused connections', async () => {
    expect((await probeTcp('127.0.0.1:1', 1000)).detail).toMatch(/ECONNREFUSED/)
  })
  it('rejects malformed targets', async () => {
    expect((await probeTcp('nope', 1000)).detail).toBe('Invalid host:port')
  })
})
