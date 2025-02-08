import { createMonitor, type MonitorType } from '../../utils/monitors'

const TYPES: MonitorType[] = ['http', 'tcp', 'heartbeat']

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody<Record<string, unknown>>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const type = body?.type as MonitorType
  const target = typeof body?.target === 'string' ? body.target.trim() : undefined

  if (!name || !TYPES.includes(type)) throw createError({ statusCode: 400, statusMessage: 'name and type (http|tcp|heartbeat) are required' })
  if (type === 'http' && !/^https?:\/\//.test(target ?? '')) throw createError({ statusCode: 400, statusMessage: 'http target must be a URL' })
  if (type === 'tcp' && !/^.+:\d+$/.test(target ?? '')) throw createError({ statusCode: 400, statusMessage: 'tcp target must be host:port' })

  const interval = Number(body.interval_s ?? 60)
  if (!Number.isInteger(interval) || interval < 30) throw createError({ statusCode: 400, statusMessage: 'interval_s must be an integer ≥ 30' })

  setResponseStatus(event, 201)
  const monitor = createMonitor(useDatabase(), {
    name,
    type,
    target,
    interval_s: interval,
    timeout_ms: Number(body.timeout_ms ?? 10_000),
  })
  return type === 'heartbeat' ? { ...monitor, pingUrl: `${getRequestURL(event).origin}/api/ping/${monitor.target}` } : monitor
})
