import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/** Guards admin endpoints with `Authorization: Bearer <NUXT_ADMIN_TOKEN>`. */
export function requireAdmin(event: H3Event): void {
  const expected = useRuntimeConfig(event).adminToken
  if (!expected) throw createError({ statusCode: 503, statusMessage: 'Set NUXT_ADMIN_TOKEN to enable the admin API' })
  const given = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
}
