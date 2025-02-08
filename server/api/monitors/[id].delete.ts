import { deleteMonitor } from '../../utils/monitors'

export default defineEventHandler((event) => {
  requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!deleteMonitor(useDatabase(), id)) throw createError({ statusCode: 404, statusMessage: 'Monitor not found' })
  setResponseStatus(event, 204)
  return null
})
