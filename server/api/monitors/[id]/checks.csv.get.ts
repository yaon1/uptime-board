import { getMonitor } from '../../../utils/monitors'

/** Raw check history as CSV for spreadsheets or SLA reports. Admin only. */
export default defineEventHandler((event) => {
  requireAdmin(event)
  const db = useDatabase()
  const monitor = getMonitor(db, Number(getRouterParam(event, 'id')))
  if (!monitor) throw createError({ statusCode: 404, statusMessage: 'Monitor not found' })
  const days = Math.min(365, Math.max(1, Number(getQuery(event).days ?? 30)))
  const rows = db
    .prepare('SELECT at, ok, latency_ms, detail FROM checks WHERE monitor_id = ? AND at >= ? ORDER BY at')
    .all(monitor.id, Date.now() - days * 86_400_000) as { at: number; ok: number; latency_ms: number | null; detail: string | null }[]

  // Quote every text field; double inner quotes per RFC 4180.
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [
    'time,ok,latency_ms,detail',
    ...rows.map((r) => [new Date(r.at).toISOString(), r.ok, r.latency_ms ?? '', quote(r.detail ?? '')].join(',')),
  ]
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${monitor.name.replace(/[^\w.-]+/g, '_')}-checks.csv"`)
  return lines.join('\n') + '\n'
})
