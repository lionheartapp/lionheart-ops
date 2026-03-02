/**
 * Shared API fetch helper for TanStack Query hooks.
 *
 * Reads the auth token from localStorage, attaches it as a Bearer token,
 * and handles 401 → logout redirects automatically.
 */

export function getAuthHeaders(): HeadersInit {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/**
 * Generic API fetcher.
 * Throws on non-ok responses so TanStack Query treats them as errors.
 * On 401 it clears stale auth data and redirects to /login.
 */
export async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
  })

  // Handle expired / invalid tokens globally
  if (res.status === 401 && typeof window !== 'undefined') {
    const keysToRemove = [
      'auth-token',
      'org-id',
      'user-name',
      'user-email',
      'user-avatar',
      'user-team',
      'user-school-scope',
      'user-role',
      'org-name',
      'org-school-type',
      'org-logo-url',
    ]
    keysToRemove.forEach((k) => localStorage.removeItem(k))
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  const json = await res.json()
  if (!json.ok) throw new Error(json.error?.message || 'API Error')
  return json.data
}
