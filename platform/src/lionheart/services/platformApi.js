/**
 * Centralized fetch wrapper for Platform API calls.
 * Same-origin when served from Next.js (single app); uses Bearer token when logged in.
 */
const PLATFORM_URL = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PLATFORM_URL?.trim()
  ? process.env.NEXT_PUBLIC_PLATFORM_URL.trim()
  : ''
const ORG_ID = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CURRENT_ORG_ID?.trim()) || ''
const AUTH_KEY = 'lionheart-auth-token'

/** When on a school subdomain (e.g. linfieldchristianschool.lionheartapp.com), set by SubdomainResolver so API calls use that org. */
let _currentOrgId = ''

export function setCurrentOrgId(orgId) {
  _currentOrgId = (orgId && String(orgId).trim()) || ''
}

export function getCurrentOrgId() {
  return _currentOrgId || ORG_ID
}

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
  } else {
    const orgId = _currentOrgId || ORG_ID
    if (orgId) headers.set('x-org-id', orgId)
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
