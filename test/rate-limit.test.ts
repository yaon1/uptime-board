import { expect, it } from 'vitest'
import { createRateLimiter } from '../server/utils/rate-limit'

it('allows `limit` hits per window per key', () => {
  let t = 0
  const allow = createRateLimiter(2, 1000, () => t)
  expect([allow('a'), allow('a'), allow('a'), allow('b')]).toEqual([true, true, false, true])
  t = 1000
  expect(allow('a')).toBe(true)
})
