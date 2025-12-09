import { findHeartbeat } from '../../../utils/monitors'
import { configuredNotifier } from '../../../utils/notify'
import { applyResult } from '../../../utils/runner'

/**
 * Explicit failure from the job itself, e.g. `backup.sh || curl .../ping/<token>/fail?msg=disk+full`.
 * Alerts right away instead of waiting for the missed-ping timeout.
 */
export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const monitor = findHeartbeat(db, getRouterParam(event, 'token') ?? '')
  if (!monitor) throw createError({ statusCode: 404, statusMessage: 'Unknown heartbeat' })

  const message = String(getQuery(event).msg ?? '').slice(0, 200)
  await applyResult(db, monitor, { ok: false, latencyMs: null, detail: message ? `Job reported failure: ${message}` : 'Job reported failure' }, configuredNotifier(useRuntimeConfig(event)))
  return { ok: true }
})
