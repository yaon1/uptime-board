import { incidents } from '../../../utils/incidents'
import { getMonitor } from '../../../utils/monitors'

// Public, like the status page: lists downtime of the last 90 days for one monitor.
export default defineEventHandler((event) => {
  const db = useDatabase()
  const monitor = getMonitor(db, Number(getRouterParam(event, 'id')))
  if (!monitor) throw createError({ statusCode: 404, statusMessage: 'Monitor not found' })
  return incidents(db, monitor.id, Date.now() - 90 * 86_400_000)
})
