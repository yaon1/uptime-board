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
    return $fetch(url, {
      method: options.method,
      body: options.body as Record<string, unknown>,
      headers: { authorization: `Bearer ${token.value}` },
    }) as Promise<T>
  }

  return { token, setToken, api }
}
