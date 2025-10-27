import { incidentFeed } from '../utils/feed'
import { incidents } from '../utils/incidents'
import { listMonitors } from '../utils/monitors'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const since = Date.now() - 90 * 86_400_000
  const items = listMonitors(db)
    .flatMap((m) => incidents(db, m.id, since).map((i) => ({ ...i, monitor: m.name })))
    .sort((a, b) => b.start - a.start)
    .slice(0, 50)
  setHeader(event, 'content-type', 'application/rss+xml; charset=utf-8')
  return incidentFeed(useRuntimeConfig(event).public.title, getRequestURL(event).origin, items)
})
