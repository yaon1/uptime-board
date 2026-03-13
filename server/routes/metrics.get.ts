import { lastCheck, listMonitors } from '../utils/monitors'
import { summarize } from '../utils/summary'

/** Prometheus exposition of what uptime-board sees, so it can feed existing dashboards and alerting. */
export default defineEventHandler((event) => {
  const db = useDatabase()
  const lines = [
    '# HELP uptime_monitor_up Whether the last check succeeded (1), failed (0); paused monitors are omitted.',
    '# TYPE uptime_monitor_up gauge',
  ]
  const latency = [
    '# HELP uptime_monitor_latency_seconds Response time of the last successful check.',
    '# TYPE uptime_monitor_latency_seconds gauge',
  ]
  const uptime = [
    '# HELP uptime_monitor_uptime_ratio Share of successful checks over the last 30 days.',
    '# TYPE uptime_monitor_uptime_ratio gauge',
  ]
  const cert = [
    '# HELP uptime_monitor_cert_expiry_timestamp_seconds TLS certificate expiry.',
    '# TYPE uptime_monitor_cert_expiry_timestamp_seconds gauge',
  ]
  const label = (s: string) => s.replace(/[\\"\n]/g, (c) => (c === '\n' ? '\\n' : `\\${c}`))

  for (const m of listMonitors(db)) {
    if (m.paused) continue
    const l = `{monitor="${label(m.name)}",type="${m.type}"}`
    const last = lastCheck(db, m.id)
    if (last) lines.push(`uptime_monitor_up${l} ${last.ok}`)
    if (last?.ok && last.latency_ms !== null) latency.push(`uptime_monitor_latency_seconds${l} ${last.latency_ms / 1000}`)
    const u = summarize(db, m, 1).uptime30d
    if (u !== null) uptime.push(`uptime_monitor_uptime_ratio${l} ${u / 100}`)
    if (m.cert_expires_at) cert.push(`uptime_monitor_cert_expiry_timestamp_seconds${l} ${Math.floor(m.cert_expires_at / 1000)}`)
  }

  setHeader(event, 'content-type', 'text/plain; version=0.0.4; charset=utf-8')
  return [...lines, ...latency, ...uptime, ...cert].join('\n') + '\n'
})
