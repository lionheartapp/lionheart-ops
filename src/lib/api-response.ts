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

/**
 * Classify an error raised from an API route's service layer and return a
 * well-formed `ApiFailure` + appropriate HTTP status. Useful inside manual
 * try/catch blocks (routes that don't use `withAuth`).
 *
 * Order of checks (most specific → least):
 *   1. Auth / missing-tenant errors → 401
 *   2. Permission errors            → 403
 *   3. Zod validation errors        → 400
 *   4. Prisma P2025 (not found)     → 404
 *   5. Prisma P2002 (unique)        → 409
 *   6. Prisma P2003 (FK violation)  → 400
 *   7. "not found" in message       → 404
 *   8. Fallback                      → 500
 */
const PERMISSION_MESSAGE_PATTERNS = [
  'Insufficient permissions',
  'Permission denied',
  'Access denied',
  'FORBIDDEN',
]

const NOT_FOUND_HINT_PATTERNS = [
  'not found',
  'does not exist',
  'no active assignment',
]

const BAD_REQUEST_HINT_PATTERNS = [
  'unknown_provider',
  'is not supported',
  'sync_not_configured',
  'not configured',
]

const CONFLICT_HINT_PATTERNS = [
  'is already taken',
  'already exists',
  'already_exists',
]

export function classifyServiceError(
  error: unknown,
  fallbackMessage: string = 'Internal server error'
): { body: ApiFailure; status: number } {
  if (isAuthError(error)) {
    return {
      body: fail('UNAUTHORIZED', error instanceof Error ? error.message : 'Unauthorized'),
      status: 401,
    }
  }

  if (error instanceof Error) {
    if (PERMISSION_MESSAGE_PATTERNS.some(p => error.message.includes(p))) {
      return {
        body: fail('FORBIDDEN', 'You do not have permission to perform this action'),
        status: 403,
      }
    }
  }

  if (error && typeof error === 'object' && 'issues' in error && 'name' in error && (error as { name?: string }).name === 'ZodError') {
    const issues = (error as { issues?: unknown[] }).issues ?? []
    return {
      body: fail('VALIDATION_ERROR', 'Invalid input', issues),
      status: 400,
    }
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code
    if (code === 'P2025') {
      return { body: fail('NOT_FOUND', 'The requested resource was not found'), status: 404 }
    }
    if (code === 'P2002') {
      const target = (error as { meta?: { target?: string[] } }).meta?.target
      const field = target?.[0] ?? 'value'
      return {
        body: fail('CONFLICT', `A record with that ${field} already exists`),
        status: 409,
      }
    }
    if (code === 'P2003') {
      return {
        body: fail('BAD_REQUEST', 'Referenced resource does not exist'),
        status: 400,
      }
    }
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase()
    if (NOT_FOUND_HINT_PATTERNS.some(p => lower.includes(p))) {
      return {
        body: fail('NOT_FOUND', 'The requested resource was not found'),
        status: 404,
      }
    }
    if (CONFLICT_HINT_PATTERNS.some(p => lower.includes(p))) {
      return {
        body: fail('CONFLICT', error.message),
        status: 409,
      }
    }
    if (BAD_REQUEST_HINT_PATTERNS.some(p => lower.includes(p))) {
      return {
        body: fail('BAD_REQUEST', error.message),
        status: 400,
      }
    }
  }

  return {
    body: fail('INTERNAL_ERROR', fallbackMessage),
    status: 500,
  }
}