import { createHmac } from 'node:crypto'

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

/** Plain text without markup, for Slack and generic consumers. */
export function formatPlain(event: AlertEvent): string {
  return formatTelegram(event).replace(/<\/?b>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

/** Slack incoming webhook (also accepted by Mattermost and Rocket.Chat). */
export function slackNotifier(webhookUrl: string): Notifier {
  if (!webhookUrl) return async () => {}
  return async (event) => {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: formatPlain(event) }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error(`[uptime-board] Slack notify failed: ${res.status}`)
  }
}

/**
 * Generic JSON webhook: the event as-is plus a text rendering. With a secret, the body is
 * signed (X-Uptime-Signature: sha256=<hmac>) so receivers can verify it came from us.
 */
export function webhookNotifier(url: string, secret = ''): Notifier {
  if (!url) return async () => {}
  return async (event) => {
    const body = JSON.stringify({ ...event, text: formatPlain(event) })
    const headers: Record<string, string> = { 'content-type': 'application/json', 'user-agent': 'uptime-board' }
    if (secret) headers['x-uptime-signature'] = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
    const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10_000) })
    if (!res.ok) console.error(`[uptime-board] webhook notify failed: ${res.status}`)
  }
}

/** Fan out to every configured channel; one failing channel doesn't block the others. */
export function combine(...notifiers: Notifier[]): Notifier {
  return async (event) => {
    await Promise.allSettled(notifiers.map((n) => n(event)))
  }
}

/** Every channel configured through runtime config (NUXT_TELEGRAM_*, NUXT_SLACK_WEBHOOK_URL, NUXT_WEBHOOK_*). */
export function configuredNotifier(config: {
  telegramBotToken: string
  telegramChatId: string
  slackWebhookUrl: string
  webhookUrl: string
  webhookSecret: string
}): Notifier {
  return combine(
    telegramNotifier(config.telegramBotToken, config.telegramChatId),
    slackNotifier(config.slackWebhookUrl),
    webhookNotifier(config.webhookUrl, config.webhookSecret),
  )
}
