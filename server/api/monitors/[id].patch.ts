import { updateMonitor } from '../../utils/monitors'
import { ValidationError, validateMonitor } from '../../utils/validate'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = (await readBody<Record<string, unknown>>(event)) ?? {}
  let changes
  try {
    changes = validateMonitor({ ...body, type: undefined }, true)
  } catch (e) {
    if (e instanceof ValidationError) throw createError({ statusCode: 400, statusMessage: e.message })
    throw e
  }
  if (body.paused !== undefined && typeof body.paused !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'paused must be a boolean' })

  const monitor = updateMonitor(useDatabase(), id, { ...changes, paused: body.paused as boolean | undefined })
  if (!monitor) throw createError({ statusCode: 404, statusMessage: 'Monitor not found' })
  return monitor
})
