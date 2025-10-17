import { expect, it } from 'vitest'
import { incidentFeed } from '../server/utils/feed'

it('renders incidents as escaped RSS items', () => {
  const xml = incidentFeed('Acme <Status>', 'https://status.acme.dev', [
    { monitor: 'API', start: Date.UTC(2026, 9, 1), end: null, durationMs: 60_000, detail: 'HTTP 502 & timeout' },
    { monitor: 'Web', start: Date.UTC(2026, 8, 1), end: Date.UTC(2026, 8, 1, 0, 5), durationMs: 300_000, detail: null },
  ])
  expect(xml).toContain('<title>Acme &lt;Status&gt; — incidents</title>')
  expect(xml).toContain('<title>API: outage ongoing</title>')
  expect(xml).toContain('<title>Web: outage resolved after 5 min</title>')
  expect(xml).toContain('HTTP 502 &amp; timeout')
  expect(xml).toContain('<pubDate>Thu, 01 Oct 2026 00:00:00 GMT</pubDate>')
})
