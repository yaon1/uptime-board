/**
 * Admin API client. The token lives in sessionStorage: it survives reloads of the tab
 * but not closing the browser, and never reaches the server except as a Bearer header.
 */
export function useAdmin() {
  const token = useState<string>('admin-token', () => '')
  if (import.meta.client && !token.value) {
    try {
      token.value = sessionStorage.getItem('uptime-admin-token') ?? ''
    } catch {
      // Storage may be blocked; the user just has to enter the token again.
    }
  }

  function setToken(value: string) {
    token.value = value
    try {
      if (value) sessionStorage.setItem('uptime-admin-token', value)
      else sessionStorage.removeItem('uptime-admin-token')
    } catch {
      // ignore storage errors
    }
  }

  function api<T>(url: string, options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {}): Promise<T> {
    // Nitro's typed routes make TypeScript compare every API route for a dynamic URL
    // ("excessive stack depth"); a plain fetch signature avoids that.
    const request = $fetch as unknown as (url: string, init: object) => Promise<T>
    return request(url, { method: options.method, body: options.body, headers: { authorization: `Bearer ${token.value}` } })
  }

  return { token, setToken, api }
}
