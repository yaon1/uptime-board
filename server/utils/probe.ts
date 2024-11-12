import { connect } from 'node:net'

export interface ProbeResult {
  ok: boolean
  latencyMs: number | null
  detail: string
}

export async function probeHttp(url: string, timeoutMs: number): Promise<ProbeResult> {
  const started = performance.now()
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'uptime-board' } })
    await res.body?.cancel()
    const latencyMs = Math.round(performance.now() - started)
    return { ok: res.status < 400, latencyMs, detail: `HTTP ${res.status}` }
  } catch (error) {
    return { ok: false, latencyMs: null, detail: describe(error) }
  }
}

/** target is "host:port". */
export function probeTcp(target: string, timeoutMs: number): Promise<ProbeResult> {
  const separator = target.lastIndexOf(':')
  const host = target.slice(0, separator).replace(/^\[|\]$/g, '')
  const port = Number(target.slice(separator + 1))
  if (separator <= 0 || !Number.isInteger(port)) return Promise.resolve({ ok: false, latencyMs: null, detail: 'Invalid host:port' })

  const started = performance.now()
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: timeoutMs })
    const done = (result: ProbeResult) => {
      socket.destroy()
      resolve(result)
    }
    socket.once('connect', () => done({ ok: true, latencyMs: Math.round(performance.now() - started), detail: 'Connected' }))
    socket.once('timeout', () => done({ ok: false, latencyMs: null, detail: `Timeout after ${timeoutMs} ms` }))
    socket.once('error', (error) => done({ ok: false, latencyMs: null, detail: describe(error) }))
  })
}

function describe(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'Timeout'
  if (error instanceof Error) {
    const cause = (error.cause as { code?: string } | undefined)?.code ?? (error as { code?: string }).code
    return cause ? `${cause}: ${error.message}` : error.message
  }
  return String(error)
}
