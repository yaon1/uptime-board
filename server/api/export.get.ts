import { exportMonitors } from '../utils/transfer'

export default defineEventHandler((event) => {
  requireAdmin(event)
  setHeader(event, 'content-disposition', 'attachment; filename="uptime-board-monitors.json"')
  return exportMonitors(useDatabase())
})
