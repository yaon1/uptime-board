import { listMonitors } from '../../utils/monitors'

export default defineEventHandler((event) => {
  requireAdmin(event)
  return listMonitors(useDatabase())
})
