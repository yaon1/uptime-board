import { checkCertificates } from '../../utils/certificates'
import { pruneChecks } from '../../utils/monitors'
import { runDueMonitors } from '../../utils/runner'
import { configuredNotifier } from '../../utils/notify'

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export default defineTask({
  meta: { name: 'monitors:run', description: 'Probe due monitors and check heartbeats' },
  async run() {
    const config = useRuntimeConfig()
    const db = useDatabase()
    const notify = configuredNotifier(config)
    const checked = await runDueMonitors(db, notify)
    await checkCertificates(db, notify, Number(config.certWarnDays))
    const pruned = pruneChecks(db, Date.now() - RETENTION_MS)
    return { result: { checked, pruned } }
  },
})
