import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { probeDns, probeHttp, probeTcp, statusMatcher } from '../server/utils/probe'

let server: Server
let port: number

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/moved') {
      res.statusCode = 301
      res.setHeader('location', 'https://elsewhere.invalid/')
      return void res.end()
    }
    if (req.url === '/page') return void res.end('<footer>Powered by Acme</footer>')
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

describe('HTTP expectations', () => {
  it('parses status specs', () => {
    const match = statusMatcher('200-204, 301')
    expect([200, 204, 205, 301, 302].map(match)).toEqual([true, true, false, true, false])
    expect(statusMatcher(null)(399)).toBe(true)
    expect(() => statusMatcher('abc')).toThrow(/Invalid status spec/)
  })

  it('requires a keyword in the body', async () => {
    expect(await probeHttp(`http://127.0.0.1:${port}/page`, 1000, { keyword: 'Powered by Acme' })).toMatchObject({ ok: true })
    expect(await probeHttp(`http://127.0.0.1:${port}/page`, 1000, { keyword: 'Error' })).toMatchObject({
      ok: false,
      detail: 'HTTP 200, "Error" not found',
    })
  })

  it('fails on unexpected status codes', async () => {
    expect(await probeHttp(`http://127.0.0.1:${port}/`, 1000, { status: '201' })).toMatchObject({ ok: false, detail: 'HTTP 200' })
  })
})

describe('probeDns', () => {
  it('resolves names and checks the expected address', async () => {
    expect((await probeDns('localhost', 2000)).ok).toBe(true)
    expect(await probeDns('localhost=127.0.0.1', 2000)).toMatchObject({ ok: true })
    expect(await probeDns('localhost=10.9.9.9', 2000)).toMatchObject({ ok: false, detail: expect.stringContaining('expected 10.9.9.9') })
  })

  it('fails for names that do not exist', async () => {
    expect((await probeDns('does-not-exist.invalid', 3000)).ok).toBe(false)
  })
})
