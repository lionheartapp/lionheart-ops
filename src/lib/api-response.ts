export type ApiSuccess<T> = {
  ok: true
  data: T
  meta?: Record<string, unknown>
}

export type ApiFailure = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiSuccess<T> {
  return { ok: true, data, ...(meta ? { meta } : {}) }
}

export function fail(code: string, message: string, details?: unknown): ApiFailure {
  return { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } }
}

/**
 * Check if an error is an authentication/authorization error from getUserContext.
 * These should always return 401 to trigger client-side redirect to login.
 */
const AUTH_ERROR_PATTERNS = [
  'Missing or invalid authorization',
  'Invalid or expired token',
  'User not found',
  'Missing x-org-id',
]

export function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return AUTH_ERROR_PATTERNS.some(pattern => error.message.includes(pattern))
}