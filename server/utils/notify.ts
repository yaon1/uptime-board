export type Notifier = (text: string) => Promise<void>

export function telegramNotifier(botToken: string, chatId: string): Notifier {
  if (!botToken || !chatId) return async () => {}
  return async (text) => {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error(`[uptime-board] Telegram notify failed: ${res.status} ${await res.text()}`)
  }
}

const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)

export function formatTransition(name: string, up: boolean, detail: string, downSince?: number, now = Date.now()): string {
  if (!up) return `🔴 <b>${escape(name)}</b> is DOWN\n${escape(detail)}`
  const minutes = downSince === undefined ? null : Math.max(1, Math.round((now - downSince) / 60_000))
  return `🟢 <b>${escape(name)}</b> is back UP${minutes ? ` after ${minutes} min` : ''}`
}
