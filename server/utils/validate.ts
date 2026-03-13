import { statusMatcher } from './probe'
import type { MonitorType, NewMonitor } from './monitors'

const TYPES: MonitorType[] = ['http', 'tcp', 'heartbeat', 'dns']

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
  if (out.type === 'dns' && !/^[a-z0-9.-]+(=[0-9a-f.:]+)?$/i.test(out.target ?? ''))
    throw new ValidationError('dns target must be a hostname, optionally hostname=expected-ip')

  if (input.interval_s !== undefined || !partial) {
    const interval = Number(input.interval_s ?? 60)
    if (!Number.isInteger(interval) || interval < 30 || interval > 86_400)
      throw new ValidationError('interval_s must be an integer between 30 and 86400')
    out.interval_s = interval
  }
  if (input.timeout_ms !== undefined || !partial) {
    const timeout = Number(input.timeout_ms ?? 10_000)
    if (!Number.isInteger(timeout) || timeout < 100 || timeout > 60_000)
      throw new ValidationError('timeout_ms must be between 100 and 60000')
    out.timeout_ms = timeout
  }
  if (input.expect_status !== undefined) {
    const spec = input.expect_status === null || input.expect_status === '' ? null : String(input.expect_status)
    if (spec !== null) {
      try {
        statusMatcher(spec)
      } catch {
        throw new ValidationError('expect_status must look like "200-299,301"')
      }
    }
    out.expect_status = spec
  }
  if (input.alert_after !== undefined) {
    const n = Number(input.alert_after)
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new ValidationError('alert_after must be between 1 and 10')
    out.alert_after = n
  }
  if (input.group_name !== undefined) {
    const g = typeof input.group_name === 'string' ? input.group_name.trim() : ''
    if (g.length > 50) throw new ValidationError('group_name must be at most 50 characters')
    out.group_name = g || null
  }
  if (input.expect_keyword !== undefined) {
    out.expect_keyword = typeof input.expect_keyword === 'string' && input.expect_keyword !== '' ? input.expect_keyword : null
  }
  return out
}
