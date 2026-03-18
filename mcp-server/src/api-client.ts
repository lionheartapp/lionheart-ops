/**
 * API client for calling Lionheart REST endpoints from the MCP server.
 * Uses a service API key for authentication.
 */

const BASE_URL = process.env.LIONHEART_API_URL || 'http://localhost:3004'
const API_KEY = process.env.LIONHEART_API_KEY || ''

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: { code: string; message: string }
}

export async function callApi<T = unknown>(
  path: string,
  options: {
    method?: string
    body?: unknown
    orgId?: string
    userId?: string
  } = {},
): Promise<T> {
  const { method = 'GET', body, orgId, userId } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Auth via API key or JWT depending on configuration
  if (API_KEY) {
    headers['x-api-key'] = API_KEY
  }
  if (orgId) {
    headers['x-org-id'] = orgId
  }
  if (userId) {
    headers['x-user-id'] = userId
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const json: ApiResponse<T> = await res.json()

  if (!json.ok) {
    throw new Error(json.error?.message || `API call failed: ${res.status}`)
  }

  return json.data as T
}
