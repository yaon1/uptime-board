import { createHmac } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { combine, formatPlain, slackNotifier, webhookNotifier, type AlertEvent } from '../server/utils/notify'

let server: Server
let base: string
const received: { path: string; body: string; headers: IncomingMessage['headers'] }[] = []

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req
      .on('data', (c) => (body += c))
      .on('end', () => {
        received.push({ path: req.url ?? '', body, headers: req.headers })
        res.statusCode = req.url === '/broken' ? 500 : 200
        res.end()
      })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => server.close())

const down: AlertEvent = { kind: 'down', monitor: 'API <prod>', detail: 'HTTP 502', at: 1 }

it('renders plain text without markup', () => {
  expect(formatPlain(down)).toBe('🔴 API <prod> is DOWN\nHTTP 502')
})

it('posts Slack messages', async () => {
  await slackNotifier(`${base}/slack`)(down)
  expect(JSON.parse(received.find((r) => r.path === '/slack')!.body)).toEqual({ text: '🔴 API <prod> is DOWN\nHTTP 502' })
})

it('signs webhook payloads', async () => {
  await webhookNotifier(`${base}/hook`, 's3cret')(down)
  const hit = received.find((r) => r.path === '/hook')!
  expect(JSON.parse(hit.body)).toMatchObject({ kind: 'down', monitor: 'API <prod>', text: formatPlain(down) })
  expect(hit.headers['x-uptime-signature']).toBe(`sha256=${createHmac('sha256', 's3cret').update(hit.body).digest('hex')}`)
})

it('keeps notifying other channels when one fails', async () => {
  const before = received.length
  await combine(webhookNotifier(`${base}/broken`), slackNotifier(`${base}/slack2`))(down)
  expect(
    received
      .slice(before)
      .map((r) => r.path)
      .sort(),
  ).toEqual(['/broken', '/slack2'])
})
