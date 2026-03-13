import { badge } from '../../utils/badge'
import { getMonitor } from '../../utils/monitors'
import { summarize } from '../../utils/summary'

/**
 * GET /badge/3.svg            → status badge
 * GET /badge/3.svg?metric=uptime → 30-day uptime badge
 */
export default defineEventHandler((event) => {
  const db = useDatabase()
  // Nitro can't match a suffix after a param ("[id].svg"), so parse "3.svg" here.
  const match = /^(\d+)\.svg$/.exec(getRouterParam(event, 'file') ?? '')
  const monitor = match ? getMonitor(db, Number(match[1])) : undefined
  if (!monitor) throw createError({ statusCode: 404 })
  const s = summarize(db, monitor, 30)

  setHeader(event, 'content-type', 'image/svg+xml')
  // Short cache so READMEs on GitHub (camo) refresh within minutes.
  setHeader(event, 'cache-control', 'max-age=120')
  if (getQuery(event).metric === 'uptime') {
    const u = s.uptime30d
    return badge(
      monitor.name,
      u === null ? 'n/a' : `${u.toFixed(2)}%`,
      u === null ? 'pending' : u >= 99.5 ? 'up' : u >= 95 ? 'degraded' : 'down',
    )
  }
  return badge(monitor.name, s.status, s.status === 'up' ? 'up' : s.status === 'down' ? 'down' : 'pending')
})
