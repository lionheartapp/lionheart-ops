/**
 * Fetch wrapper for Platform client-side API calls.
 * Uses Bearer token when logged in, otherwise x-org-id from env.
 */
const ORG_ID = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID?.trim() || ''
const AUTH_KEY = 'lionheart-auth-token'

function getPlatformToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(AUTH_KEY)
  } catch {
    return null
  }
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getPlatformToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  } else if (ORG_ID) {
    headers.set('x-org-id', ORG_ID)
  }
  const isFormData = init.body instanceof FormData
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(path, { ...init, headers })
}
