/**
 * Client-side auth utilities
 *
 * Handles stale token detection and redirects to login.
 */

/**
 * Check an API response for 401 status and redirect to login if needed.
 * Call this after every authenticated fetch() in client components.
 *
 * Returns true if the response was a 401 (caller should stop processing).
 */
export function handleAuthResponse(response: Response): boolean {
  if (response.status === 401) {
    // Clear stale auth data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth-token')
      localStorage.removeItem('org-id')
      localStorage.removeItem('user-name')
      localStorage.removeItem('user-email')
      localStorage.removeItem('user-avatar')
      localStorage.removeItem('user-team')
      localStorage.removeItem('user-school-scope')
      localStorage.removeItem('user-role')
      localStorage.removeItem('org-name')
      localStorage.removeItem('org-school-type')
      localStorage.removeItem('org-logo-url')
      window.location.href = '/login'
    }
    return true
  }
  return false
}
