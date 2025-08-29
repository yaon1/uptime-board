/** What happened, independent of how a channel renders it. */
export type AlertEvent =
  | { kind: 'down'; monitor: string; detail: string; at: number }
  | { kind: 'up'; monitor: string; detail: string; at: number; downtimeMs: number | null }
  | { kind: 'cert'; monitor: string; daysLeft: number; at: number }

export type Notifier = (event: AlertEvent) => Promise<void>

const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

/** Human-readable text with Telegram HTML markup. */
export function formatTelegram(event: AlertEvent): string {
  const name = `<b>${escape(event.monitor)}</b>`
  switch (event.kind) {
    case 'down':
      return `🔴 ${name} is DOWN\n${escape(event.detail)}`
    case 'up': {
      const minutes = event.downtimeMs === null ? null : Math.max(1, Math.round(event.downtimeMs / 60_000))
      return `🟢 ${name} is back UP${minutes ? ` after ${minutes} min` : ''}`
    }
    case 'cert':
      return event.daysLeft < 0 ? `🔐 ${name}: TLS certificate expired` : `🔐 ${name}: TLS certificate expires in ${event.daysLeft} days`
  }
}

export function telegramNotifier(botToken: string, chatId: string): Notifier {
  if (!botToken || !chatId) return async () => {}
  return async (event) => {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: formatTelegram(event), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error(`[uptime-board] Telegram notify failed: ${res.status} ${await res.text()}`)
  }
}
