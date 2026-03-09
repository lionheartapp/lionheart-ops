/**
 * Client-side auth utilities
 *
 * Handles stale session detection and redirects to login.
 *
 * With cookie-based auth, the server clears the auth-token cookie via
 * POST /api/auth/logout. This module handles the client-side cleanup of
 * any legacy localStorage data from the old auth pattern and triggers
 * a redirect.
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
 * Check an API response for 401 status and redirect to login if needed.
 * Call this after every authenticated fetch() in client components.
 *
 * Returns true if the response was a 401 (caller should stop processing).
 */
export function handleAuthResponse(response: Response): boolean {
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      // Clean up any legacy localStorage data from the old auth pattern
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
      window.location.href = '/login'
    }
    return true
  }
  return false
}
