import { getMonitor } from '../../../utils/monitors'
import { latencyHistory } from '../../../utils/summary'

export default defineEventHandler((event) => {
  const db = useDatabase()
  const monitor = getMonitor(db, Number(getRouterParam(event, 'id')))
  if (!monitor) throw createError({ statusCode: 404, statusMessage: 'Monitor not found' })
  const hours = Math.min(168, Math.max(1, Number(getQuery(event).hours ?? 24)))
  return latencyHistory(db, monitor.id, hours)
})
