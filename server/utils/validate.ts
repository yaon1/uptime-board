import type { MonitorType, NewMonitor } from './monitors'

const TYPES: MonitorType[] = ['http', 'tcp', 'heartbeat']

export class ValidationError extends Error {}

/**
 * Validates monitor input from the admin API. With `partial`, missing fields are
 * allowed (for updates) but present ones must still be valid.
 */
export function validateMonitor(body: Record<string, unknown> | null | undefined, partial = false): Partial<NewMonitor> {
  const input = body ?? {}
  const out: Partial<NewMonitor> = {}

  if (input.name !== undefined || !partial) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) throw new ValidationError('name is required')
    if (name.length > 100) throw new ValidationError('name must be at most 100 characters')
    out.name = name
  }
  if (input.type !== undefined || !partial) {
    if (!TYPES.includes(input.type as MonitorType)) throw new ValidationError(`type must be one of ${TYPES.join(', ')}`)
    out.type = input.type as MonitorType
  }
  if (input.target !== undefined) {
    if (typeof input.target !== 'string') throw new ValidationError('target must be a string')
    out.target = input.target.trim()
  }
  if (out.type === 'http' && !/^https?:\/\/\S+$/.test(out.target ?? '')) throw new ValidationError('http target must be a URL')
  if (out.type === 'tcp' && !/^.+:\d{1,5}$/.test(out.target ?? '')) throw new ValidationError('tcp target must be host:port')

  if (input.interval_s !== undefined || !partial) {
    const interval = Number(input.interval_s ?? 60)
    if (!Number.isInteger(interval) || interval < 30 || interval > 86_400) throw new ValidationError('interval_s must be an integer between 30 and 86400')
    out.interval_s = interval
  }
  if (input.timeout_ms !== undefined || !partial) {
    const timeout = Number(input.timeout_ms ?? 10_000)
    if (!Number.isInteger(timeout) || timeout < 100 || timeout > 60_000) throw new ValidationError('timeout_ms must be between 100 and 60000')
    out.timeout_ms = timeout
  }
  return out
}
