import { cancelMaintenance } from '../../utils/maintenance'

export default defineEventHandler((event) => {
  requireAdmin(event)
  if (!cancelMaintenance(useDatabase(), Number(getRouterParam(event, 'id')))) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setResponseStatus(event, 204)
  return null
})
