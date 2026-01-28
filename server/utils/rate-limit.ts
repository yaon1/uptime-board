/**
 * Fixed-window limiter in memory. Good enough for a single-process app: protects the
 * ping endpoint from a misconfigured cron (`* * * * * * …`) filling the database.
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return (key: string): boolean => {
    const t = now()
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= t) {
      if (hits.size > 10_000) hits.clear() // bound memory under abuse
      hits.set(key, { count: 1, resetAt: t + windowMs })
      return true
    }
    entry.count++
    return entry.count <= limit
  }
}
