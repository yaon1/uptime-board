import { createMonitor, type NewMonitor } from '../../utils/monitors'
import { ValidationError, validateMonitor } from '../../utils/validate'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  let input: NewMonitor
  try {
    input = validateMonitor(await readBody(event)) as NewMonitor
  } catch (e) {
    if (e instanceof ValidationError) throw createError({ statusCode: 400, statusMessage: e.message })
    throw e
  }

  setResponseStatus(event, 201)
  const monitor = createMonitor(useDatabase(), input)
  return monitor.type === 'heartbeat' ? { ...monitor, pingUrl: `${getRequestURL(event).origin}/api/ping/${monitor.target}` } : monitor
})
