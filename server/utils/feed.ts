import type { Incident } from './incidents'

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)

/** RSS 2.0 feed of incidents, so people can subscribe to outages without an account. */
export function incidentFeed(title: string, siteUrl: string, items: (Incident & { monitor: string })[]): string {
  const entries = items
    .map((i) => {
      const state = i.end === null ? 'ongoing' : `resolved after ${Math.max(1, Math.round(i.durationMs / 60_000))} min`
      return `<item>
<title>${escape(`${i.monitor}: outage ${state}`)}</title>
<description>${escape(i.detail ?? '')}</description>
<pubDate>${new Date(i.start).toUTCString()}</pubDate>
<guid isPermaLink="false">${escape(`${i.monitor}-${i.start}`)}</guid>
<link>${escape(siteUrl)}</link>
</item>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${escape(title)} — incidents</title>
<link>${escape(siteUrl)}</link>
<description>Outages detected by uptime-board</description>
${entries}
</channel></rss>
`
}
