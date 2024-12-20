import { pruneChecks } from '../../utils/monitors'
import { runDueMonitors } from '../../utils/runner'
import { telegramNotifier } from '../../utils/notify'

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export default defineTask({
  meta: { name: 'monitors:run', description: 'Probe due monitors and check heartbeats' },
  async run() {
    const config = useRuntimeConfig()
    const db = useDatabase()
    const checked = await runDueMonitors(db, telegramNotifier(config.telegramBotToken, config.telegramChatId))
    const pruned = pruneChecks(db, Date.now() - RETENTION_MS)
    return { result: { checked, pruned } }
  },
})
