import { incidents } from '../utils/incidents'
import { listMonitors } from '../utils/monitors'

/** Latest incidents across all monitors for the status page history. */
export default defineEventHandler(() => {
  const db = useDatabase()
  const since = Date.now() - 30 * 86_400_000
  return listMonitors(db)
    .flatMap((m) => incidents(db, m.id, since).map((i) => ({ ...i, monitor: m.name })))
    .sort((a, b) => b.start - a.start)
    .slice(0, 20)
})
