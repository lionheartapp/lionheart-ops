/**
 * Shared API fetch helper for TanStack Query hooks.
 *
 * Cookie-based auth: JWT is stored in an httpOnly cookie set by the server.
 * The browser automatically sends the cookie with every fetch that includes
 * `credentials: 'include'`. CSRF tokens are read from the non-httpOnly
 * csrf-token cookie and sent as the X-CSRF-Token header on state-changing
 * requests.
 *
 * Legacy compatibility: existing localStorage sessions still work because
 * middleware falls back to the Authorization header during the migration period.
 */

const LEGACY_KEYS = [
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
] as const

/**
 * Read the CSRF token from the non-httpOnly csrf-token cookie.
 * Returns null when running server-side or when no CSRF cookie exists.
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split(';').find((c) => c.trim().startsWith('csrf-token='))
  return match ? match.trim().slice('csrf-token='.length) : null
}

/**
 * Build request headers.
 * Includes Content-Type and CSRF token when available.
 * No longer reads localStorage for the auth token — cookie is sent automatically.
 */
export function getAuthHeaders(): HeadersInit {
  const csrfToken = getCsrfToken()
  return {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
  }
}

/**
 * Generic API fetcher.
 * Sends credentials (cookies) on every request.
 * On 401: clears any legacy localStorage data and redirects to /login.
 * Throws on non-ok JSON responses so TanStack Query treats them as errors.
 */
export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { ...getAuthHeaders(), ...options?.headers },
  })

  // Session expired or cookie missing — clean up and redirect
  if (res.status === 401 && typeof window !== 'undefined') {
    // Clean up any legacy localStorage data from the old auth pattern
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
    window.location.href = '/login'
    throw new Error('Session expired')
  }

  const json = await res.json()
  if (!json.ok) {
    const err = new Error(json.error?.message || 'API Error') as Error & { code?: string; details?: unknown }
    err.code = json.error?.code
    err.details = json.error?.details
    throw err
  }
  return json.data
}
