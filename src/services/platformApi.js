/**
 * Centralized fetch wrapper for Platform API calls.
 * Uses Bearer token when logged in, otherwise x-org-id from env.
 */

const PLATFORM_URL = import.meta.env.VITE_PLATFORM_URL?.trim() || 'http://localhost:3001'
const ORG_ID = import.meta.env.VITE_CURRENT_ORG_ID?.trim() || ''
const AUTH_KEY = 'lionheart-auth-token'

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token) {
  try {
    localStorage.setItem(AUTH_KEY, token)
  } catch {}
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(AUTH_KEY)
  } catch {}
}

function getHeaders(init = {}) {
  const headers = new Headers(init.headers)
  const token = getAuthToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  } else if (ORG_ID) {
    headers.set('x-org-id', ORG_ID)
  }
  const isFormData = init.body instanceof FormData
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

/**
 * Fetch from the Platform API. Always includes x-org-id header.
 * @param {string} path - API path (e.g. '/api/search') or full URL
 * @param {RequestInit} [init] - fetch init options
 * @returns {Promise<Response>}
 */
export function platformFetch(path, init = {}) {
  const url = path.startsWith('http') ? path : `${PLATFORM_URL}${path}`
  return fetch(url, {
    ...init,
    headers: getHeaders(init),
  })
}

/**
 * GET request to Platform API.
 */
export function platformGet(path) {
  return platformFetch(path, { method: 'GET' })
}

/**
 * POST request to Platform API.
 */
export function platformPost(path, body) {
  return platformFetch(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * PATCH request to Platform API.
 */
export function platformPatch(path, body) {
  return platformFetch(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  })
}

export { PLATFORM_URL, ORG_ID }
