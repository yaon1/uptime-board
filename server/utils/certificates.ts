import type { DatabaseSync } from 'node:sqlite'
import type { Monitor } from './monitors'
import type { Notifier } from './notify'
import { certificateExpiry } from './probe'

const DAY = 86_400_000

/**
 * Refreshes certificate expiry for https monitors once a day and warns once when a
 * certificate enters the warning window; a renewed certificate gets its own warning later.
 */
export async function checkCertificates(
  db: DatabaseSync,
  notify: Notifier,
  warnDays = 14,
  now = Date.now(),
  lookup: (url: string) => Promise<Date | null> = certificateExpiry,
): Promise<void> {
  const due = db
    .prepare(
      `SELECT * FROM monitors WHERE type = 'http' AND paused = 0 AND target LIKE 'https://%' AND (cert_checked_at IS NULL OR cert_checked_at <= ?)`,
    )
    .all(now - DAY) as unknown as Monitor[]

  for (const m of due) {
    const expiry = (await lookup(m.target))?.getTime() ?? null
    db.prepare('UPDATE monitors SET cert_expires_at = ?, cert_checked_at = ? WHERE id = ?').run(expiry, now, m.id)
    if (expiry === null) continue

    const daysLeft = Math.floor((expiry - now) / DAY)
    if (daysLeft <= warnDays && m.cert_warned_for !== expiry) {
      db.prepare('UPDATE monitors SET cert_warned_for = ? WHERE id = ?').run(expiry, m.id)
      await notify({ kind: 'cert', monitor: m.name, daysLeft, at: now })
    }
  }
}
