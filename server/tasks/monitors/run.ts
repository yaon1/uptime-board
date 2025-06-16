import { checkCertificates } from '../../utils/certificates'
import { pruneChecks } from '../../utils/monitors'
import { runDueMonitors } from '../../utils/runner'
import { telegramNotifier } from '../../utils/notify'

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export default defineTask({
  meta: { name: 'monitors:run', description: 'Probe due monitors and check heartbeats' },
  async run() {
    const config = useRuntimeConfig()
    const db = useDatabase()
    const notify = telegramNotifier(config.telegramBotToken, config.telegramChatId)
    const checked = await runDueMonitors(db, notify)
    await checkCertificates(db, notify, Number(config.certWarnDays))
    const pruned = pruneChecks(db, Date.now() - RETENTION_MS)
    return { result: { checked, pruned } }
  },
})
