import { listMonitors } from '../utils/monitors'
import { summarize } from '../utils/summary'

export default defineEventHandler(() => {
  const db = useDatabase()
  const monitors = listMonitors(db).map((m) => summarize(db, m))
  const down = monitors.filter((m) => m.status === 'down').length
  return {
    overall: down === 0 ? 'operational' : down === monitors.length ? 'outage' : 'degraded',
    monitors,
    generatedAt: Date.now(),
  }
})
