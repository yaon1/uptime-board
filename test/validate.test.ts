import { describe, expect, it } from 'vitest'
import { validateMonitor } from '../server/utils/validate'

describe('validateMonitor', () => {
  it('applies defaults for new monitors', () => {
    expect(validateMonitor({ name: ' Site ', type: 'http', target: 'https://x.dev' })).toEqual({
      name: 'Site',
      type: 'http',
      target: 'https://x.dev',
      interval_s: 60,
      timeout_ms: 10_000,
    })
  })

  it.each([
    [{ type: 'http', target: 'https://x' }, /name is required/],
    [{ name: 'a', type: 'ftp' }, /type must be one of/],
    [{ name: 'a', type: 'http', target: 'x.dev' }, /must be a URL/],
    [{ name: 'a', type: 'tcp', target: 'db' }, /host:port/],
    [{ name: 'a', type: 'heartbeat', interval_s: 10 }, /between 30 and 86400/],
    [{ name: 'a', type: 'heartbeat', timeout_ms: 5 }, /between 100 and 60000/],
  ])('rejects %o', (body, error) => {
    expect(() => validateMonitor(body)).toThrow(error)
  })

  it('allows partial updates', () => {
    expect(validateMonitor({ interval_s: 120 }, true)).toEqual({ interval_s: 120 })
    expect(() => validateMonitor({ name: '' }, true)).toThrow(/name is required/)
  })

  it('validates HTTP expectations', () => {
    expect(validateMonitor({ expect_status: '200-299', expect_keyword: 'OK' }, true)).toEqual({
      expect_status: '200-299',
      expect_keyword: 'OK',
    })
    expect(() => validateMonitor({ expect_status: 'all' }, true)).toThrow(/expect_status/)
  })

  it('validates DNS targets', () => {
    expect(validateMonitor({ name: 'mx', type: 'dns', target: 'mail.acme.dev=203.0.113.7' })).toMatchObject({ type: 'dns' })
    expect(() => validateMonitor({ name: 'mx', type: 'dns', target: 'https://acme.dev' })).toThrow(/dns target/)
  })
})
