import { lookup as dnsLookup } from 'node:dns/promises'
import { connect } from 'node:net'
import { connect as tlsConnect } from 'node:tls'

export interface ProbeResult {
  ok: boolean
  latencyMs: number | null
  detail: string
}

export interface HttpExpectations {
  /** Accepted status codes, e.g. "200-299,301". Default: anything below 400. */
  status?: string | null
  /** Text that must appear in the response body, e.g. a footer that only renders when the app works. */
  keyword?: string | null
}

/** Parses "200-299,301" into a matcher; null/empty accepts < 400. */
export function statusMatcher(spec: string | null | undefined): (status: number) => boolean {
  if (!spec?.trim()) return (status) => status < 400
  const ranges = spec.split(',').map((part) => {
    const [from, to] = part.trim().split('-').map(Number)
    if (!Number.isInteger(from) || (to !== undefined && !Number.isInteger(to))) throw new Error(`Invalid status spec "${spec}"`)
    return [from!, to ?? from!] as const
  })
  return (status) => ranges.some(([from, to]) => status >= from && status <= to)
}

export async function probeHttp(url: string, timeoutMs: number, expect: HttpExpectations = {}): Promise<ProbeResult> {
  const started = performance.now()
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'uptime-board' } })
    // Only download the body when we need to search it; otherwise cancel to save bandwidth.
    const body = expect.keyword ? await res.text() : (await res.body?.cancel(), '')
    const latencyMs = Math.round(performance.now() - started)
    if (!statusMatcher(expect.status)(res.status)) return { ok: false, latencyMs, detail: `HTTP ${res.status}` }
    if (expect.keyword && !body.includes(expect.keyword)) return { ok: false, latencyMs, detail: `HTTP ${res.status}, "${expect.keyword}" not found` }
    return { ok: true, latencyMs, detail: `HTTP ${res.status}` }
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

/** Expiry of the TLS certificate served for an https URL, or null for plain http / errors. */
export function certificateExpiry(url: string, timeoutMs = 5000): Promise<Date | null> {
  const { protocol, hostname, port } = new URL(url)
  if (protocol !== 'https:') return Promise.resolve(null)
  return new Promise((resolve) => {
    // Read the certificate even if it's invalid: an expired cert is exactly what we want to report.
    const socket = tlsConnect({ host: hostname, port: Number(port || 443), servername: hostname, rejectUnauthorized: false, timeout: timeoutMs }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      resolve(cert?.valid_to ? new Date(cert.valid_to) : null)
    })
    socket.once('error', () => resolve(null))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(null)
    })
  })
}

/**
 * Resolves a hostname through the system resolver. Target "host" just needs an answer;
 * "host=1.2.3.4" additionally requires that address among the results (catches hijacked
 * or forgotten DNS records after a migration).
 */
export async function probeDns(target: string, timeoutMs: number): Promise<ProbeResult> {
  const [host, expected] = target.split('=') as [string, string | undefined]
  const started = performance.now()
  try {
    const answers = await Promise.race([
      dnsLookup(host, { all: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${timeoutMs} ms`)), timeoutMs)),
    ])
    const addresses = answers.map((a) => a.address)
    const latencyMs = Math.round(performance.now() - started)
    if (expected && !addresses.includes(expected)) return { ok: false, latencyMs, detail: `Resolved to ${addresses.join(', ')}, expected ${expected}` }
    return { ok: true, latencyMs, detail: addresses.join(', ') }
  } catch (error) {
    return { ok: false, latencyMs: null, detail: describe(error) }
  }
}
