import { findHeartbeat } from '../../utils/monitors'
import { telegramNotifier } from '../../utils/notify'
import { applyResult } from '../../utils/runner'

// Accepts GET or POST so it works with `curl` from cron and with webhook senders.
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const monitor = findHeartbeat(db, getRouterParam(event, 'token') ?? '')
  if (!monitor) throw createError({ statusCode: 404, statusMessage: 'Unknown heartbeat' })

  const config = useRuntimeConfig(event)
  await applyResult(db, monitor, { ok: true, latencyMs: null, detail: 'Ping received' }, telegramNotifier(config.telegramBotToken, config.telegramChatId))
  return { ok: true }
})
