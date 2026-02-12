import { findHeartbeat } from '../../utils/monitors'
import { configuredNotifier } from '../../utils/notify'
import { createRateLimiter } from '../../utils/rate-limit'
import { applyResult } from '../../utils/runner'

const allow = createRateLimiter(6, 60_000)

// Accepts GET or POST so it works with `curl` from cron and with webhook senders.
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const monitor = findHeartbeat(db, getRouterParam(event, 'token') ?? '')
  if (!monitor) throw createError({ statusCode: 404, statusMessage: 'Unknown heartbeat' })
  if (!allow(monitor.target)) throw createError({ statusCode: 429, statusMessage: 'Too many pings; at most 6 per minute' })

  const config = useRuntimeConfig(event)
  await applyResult(db, monitor, { ok: true, latencyMs: null, detail: 'Ping received' }, configuredNotifier(config))
  return { ok: true }
})
