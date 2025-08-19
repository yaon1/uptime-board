import { upcomingMaintenance } from '../../utils/maintenance'

// Public: the status page announces planned work.
export default defineEventHandler(() => upcomingMaintenance(useDatabase()))
