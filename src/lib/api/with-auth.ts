/**
 * Route Handler Wrapper — eliminates API route boilerplate
 *
 * Handles: org context, auth, permissions, Zod validation, error classification,
 * Sentry tagging, and structured logging.
 *
 * Usage:
 *   // Simple — no permission check
 *   export const GET = withAuth(async ({ req, orgId, ctx }) => {
 *     const data = await prisma.model.findMany(...)
 *     return NextResponse.json(ok(data))
 *   })
 *
 *   // With permission check
 *   export const POST = withAuth(async ({ req, orgId, ctx }) => {
 *     const item = await service.create(body, ctx.userId)
 *     return NextResponse.json(ok(item), { status: 201 })
 *   }, { permission: PERMISSIONS.SETTINGS_UPDATE })
 *
 *   // With Zod body parsing
 *   export const POST = withAuth(async ({ req, orgId, ctx, body }) => {
 *     // body is already validated & typed
 *     return NextResponse.json(ok(await service.create(body)))
 *   }, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateSchema })
 *
 *   // Dynamic route with params
 *   export const GET = withAuth(async ({ req, orgId, ctx, params }) => {
 *     const item = await service.getById(params.id)
 *     return NextResponse.json(ok(item))
 *   })
 */

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodSchema } from 'zod'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext, type RequestContext } from '@/lib/request-context'
import { assertCan, can, canAny } from '@/lib/auth/permissions'
import { getTrialState } from '@/lib/trial-utils'
import { audit as writeAuditLog, getIp, type AuditAction } from '@/lib/services/auditService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

// ---------------------------------------------------------------------------
// Read-only enforcement after trial expiry
// ---------------------------------------------------------------------------

/**
 * API path prefixes that stay writable even when the free trial has expired.
 * Everything here is needed to unlock read-only mode (upgrade flow) or is
 * session-level plumbing that should always work.
 */
const READ_ONLY_WRITE_ALLOWLIST = [
  '/api/billing/',
  '/api/stripe/',
  '/api/auth/',
  '/api/settings/billing',
  '/api/settings/organization/delete',
  '/api/organizations/signup',
]

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function isWritableDuringReadOnly(pathname: string): boolean {
  return READ_ONLY_WRITE_ALLOWLIST.some((p) => pathname.startsWith(p))
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Context passed to every route handler */
export interface RouteContext<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
> {
  req: NextRequest
  orgId: string
  ctx: RequestContext
  /** Parsed + validated request body (only present when `schema` option is used) */
  body: TBody
  /** Awaited dynamic route params (e.g. { id: string }) */
  params: TParams
  /** Parsed URL search params for convenience */
  searchParams: URLSearchParams
  /** Permission helpers scoped to current user */
  permissions: {
    can: (permission: string) => Promise<boolean>
    canAny: (permissions: string[]) => Promise<boolean>
  }
}

/** Handler function signature */
type Handler<TBody, TParams extends Record<string, string>> = (
  context: RouteContext<TBody, TParams>
) => Promise<NextResponse>

/** Audit logging configuration */
interface AuditConfig {
  /** Override the auto-derived action name (e.g. 'user.invite') */
  action?: AuditAction
  /** Resource type (e.g. 'User', 'Ticket'). Auto-derived from path if omitted. */
  resourceType?: string
}

/** Options for the wrapper */
interface WithAuthOptions<TBody> {
  /** Permission string — checked via assertCan() before handler runs */
  permission?: string
  /** Array of permissions — passes if user has ANY of them */
  permissionAny?: string[]
  /** Zod schema — parses req.json() and provides typed `body` */
  schema?: ZodSchema<TBody>
  /** Route label for logging (auto-detected from req.url if omitted) */
  routeLabel?: string
  /**
   * Audit logging for mutations (POST/PUT/PATCH/DELETE).
   * - `true` or omitted: auto-log with derived action name (default for mutations)
   * - `false`: disable audit logging for this route
   * - `AuditConfig`: custom action name / resource type
   */
  audit?: boolean | AuditConfig
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

const PERMISSION_PATTERNS = [
  'Permission denied',
  'Insufficient permissions',
  'Access denied',
  'FORBIDDEN',
]

function isPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return PERMISSION_PATTERNS.some((p) => error.message.includes(p))
}

const NOT_FOUND_HINT_PATTERNS = [
  'not found',
  'does not exist',
  'no active assignment',
]

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const lower = error.message.toLowerCase()
  return NOT_FOUND_HINT_PATTERNS.some((p) => lower.includes(p))
}

const BAD_REQUEST_PATTERNS = [
  'unknown_provider',
  'is not supported',
  'sync_not_configured',
  'not configured',
  'invalid input',
]

function isBadRequestError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const lower = error.message.toLowerCase()
  return BAD_REQUEST_PATTERNS.some((p) => lower.includes(p))
}

const CONFLICT_PATTERNS = [
  'is already taken',
  'already exists',
  'already_exists',
  'conflict',
]

function isConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const lower = error.message.toLowerCase()
  return CONFLICT_PATTERNS.some((p) => lower.includes(p))
}

function isPrismaUniqueConstraint(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}

function isPrismaRecordNotFound(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2025'
  )
}

function isPrismaForeignKeyViolation(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2003'
  )
}

function classifyError(error: unknown): NextResponse {
  // Auth errors → 401
  if (isAuthError(error)) {
    return NextResponse.json(
      fail('UNAUTHORIZED', error instanceof Error ? error.message : 'Unauthorized'),
      { status: 401 }
    )
  }

  // Zod validation → 400
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid input', error.issues),
      { status: 400 }
    )
  }

  // Permission → 403 (never leak internal permission details to clients)
  if (isPermissionError(error)) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Permission denied'
    )
    return NextResponse.json(
      fail('FORBIDDEN', 'You do not have permission to perform this action'),
      { status: 403 }
    )
  }

  // Not found → 404 (never leak internal "which record" details to clients)
  if (isNotFoundError(error)) {
    return NextResponse.json(
      fail('NOT_FOUND', 'The requested resource was not found'),
      { status: 404 }
    )
  }

  // Known business-logic bad-request hints → 400
  if (isBadRequestError(error)) {
    return NextResponse.json(
      fail('BAD_REQUEST', error instanceof Error ? error.message : 'Invalid request'),
      { status: 400 }
    )
  }

  // Known business-logic conflict hints → 409
  if (isConflictError(error)) {
    return NextResponse.json(
      fail('CONFLICT', error instanceof Error ? error.message : 'Conflict'),
      { status: 409 }
    )
  }

  // Prisma unique constraint → 409
  if (isPrismaUniqueConstraint(error)) {
    const target = (error as { meta?: { target?: string[] } }).meta?.target
    const field = target?.[0] ?? 'value'
    return NextResponse.json(
      fail('CONFLICT', `A record with that ${field} already exists`),
      { status: 409 }
    )
  }

  // Prisma record-not-found → 404 (e.g. .update/.delete/.findUniqueOrThrow on a missing row)
  if (isPrismaRecordNotFound(error)) {
    return NextResponse.json(
      fail('NOT_FOUND', 'The requested resource was not found'),
      { status: 404 }
    )
  }

  // Prisma FK violation → 400 (user passed an id that references a non-existent row)
  if (isPrismaForeignKeyViolation(error)) {
    return NextResponse.json(
      fail('BAD_REQUEST', 'Referenced resource does not exist'),
      { status: 400 }
    )
  }

  // Catch-all → 500 (never leak internal error details to clients)
  return NextResponse.json(
    fail('INTERNAL_ERROR', 'Internal server error'),
    { status: 500 }
  )
}

// ---------------------------------------------------------------------------
// Auto-audit helpers
// ---------------------------------------------------------------------------

const METHOD_VERB: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
}

/**
 * Derive an audit action from the request method and URL path.
 *
 * Examples:
 *   PATCH /api/settings/users/abc123         → "settings.users.update"
 *   POST  /api/tickets                       → "tickets.create"
 *   DELETE /api/maintenance/tickets/abc/costs → "maintenance.tickets.costs.delete"
 *
 * Dynamic segments (UUIDs, cuid-style IDs) are stripped so the action
 * is stable across different records.
 */
function deriveAuditAction(method: string, pathname: string): string {
  const verb = METHOD_VERB[method] || method.toLowerCase()

  // Strip /api/ prefix and split into segments
  const segments = pathname
    .replace(/^\/api\//, '')
    .split('/')
    .filter((s) => s && !looksLikeId(s))

  const resource = segments.join('.')
  return resource ? `${resource}.${verb}` : verb
}

/**
 * Derive a resource type from the URL path (first meaningful segment after /api/).
 * "settings/users/abc" → "User", "tickets/abc" → "Ticket", "maintenance/tickets" → "MaintenanceTicket"
 */
function deriveResourceType(pathname: string): string | undefined {
  const segments = pathname
    .replace(/^\/api\//, '')
    .split('/')
    .filter((s) => s && !looksLikeId(s))

  if (segments.length === 0) return undefined

  // Use the last non-ID segment, singularized naively
  const last = segments[segments.length - 1]
  // "users" → "User", "tickets" → "Ticket"
  const singular = last.endsWith('s') && !last.endsWith('ss')
    ? last.slice(0, -1)
    : last
  return singular.charAt(0).toUpperCase() + singular.slice(1)
}

/** Heuristic: segment looks like a dynamic ID (cuid, uuid, or numeric) */
function looksLikeId(segment: string): boolean {
  // cuid: starts with c, 25 chars
  if (/^c[a-z0-9]{24}$/.test(segment)) return true
  // uuid: 8-4-4-4-12 hex
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true
  // numeric
  if (/^\d+$/.test(segment)) return true
  // Long random strings (cuid2, nanoid, etc.)
  if (/^[a-z0-9]{20,}$/.test(segment)) return true
  return false
}

// ---------------------------------------------------------------------------
// withAuth
// ---------------------------------------------------------------------------

/**
 * Wrap a route handler with auth, org context, and error handling.
 *
 * Returns a standard Next.js route handler compatible with both
 * top-level routes and dynamic `[id]` routes.
 */
/** Next.js route handler type — second param is required for generated type-checks */
type NextRouteHandler<TParams extends Record<string, string>> = (
  req: NextRequest,
  context: { params: Promise<TParams> }
) => Promise<NextResponse>

export function withAuth<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
>(
  handler: Handler<TBody, TParams>,
  options?: WithAuthOptions<TBody>
): NextRouteHandler<TParams> {
  async function routeHandler(
    req: NextRequest,
    /** Next.js passes { params: Promise<...> } for dynamic routes */
    nextContext?: { params?: Promise<TParams> }
  ): Promise<NextResponse> {
    const routeLabel =
      options?.routeLabel ?? new URL(req.url).pathname
    const log = logger.child({ route: routeLabel, method: req.method })

    try {
      const orgId = getOrgIdFromRequest(req)
      const ctx = await getUserContext(req)

      Sentry.setTag('org_id', orgId)

      // Read-only gate — block mutating requests when trial has expired
      // and there's no active paid subscription. Billing/auth routes stay
      // open so the user can actually upgrade out of read-only mode.
      if (MUTATING_METHODS.has(req.method)) {
        const pathname = new URL(req.url).pathname
        if (!isWritableDuringReadOnly(pathname)) {
          const trialState = getTrialState({
            trialEndsAt: ctx.orgTrialEndsAt,
            subscriptionStatus: ctx.orgSubscriptionStatus,
          })
          if (trialState.readOnly) {
            return NextResponse.json(
              fail(
                'TRIAL_EXPIRED',
                'Your free trial has ended. Upgrade to a paid plan to continue editing your workspace.'
              ),
              { status: 402 }
            )
          }
        }
      }

      // Permission gate — fail fast before doing any work
      if (options?.permission) {
        await assertCan(ctx.userId, options.permission)
      }
      if (options?.permissionAny) {
        const hasAny = await canAny(ctx.userId, options.permissionAny)
        if (!hasAny) {
          return NextResponse.json(
            fail('FORBIDDEN', 'Insufficient permissions'),
            { status: 403 }
          )
        }
      }

      // Await dynamic params if present
      const params = (nextContext?.params ? await nextContext.params : {} as TParams)

      // Parse + validate body if schema provided
      let body = undefined as unknown as TBody
      if (options?.schema) {
        const raw = await req.json()
        body = options.schema.parse(raw)
      }

      const searchParams = new URL(req.url).searchParams

      // Permission helpers scoped to this user
      const permissions = {
        can: (permission: string) => can(ctx.userId, permission),
        canAny: (perms: string[]) => canAny(ctx.userId, perms),
      }

      const response = await runWithOrgContext(orgId, () =>
        handler({ req, orgId, ctx, body, params, searchParams, permissions })
      )

      // ── Auto-audit for mutations ──────────────────────────────────
      // Fire-and-forget: log successful state-changing requests unless
      // the route explicitly opts out with `{ audit: false }`.
      const auditOpt = options?.audit
      if (
        MUTATING_METHODS.has(req.method) &&
        auditOpt !== false &&
        response.status >= 200 &&
        response.status < 300
      ) {
        const pathname = new URL(req.url).pathname
        const config = typeof auditOpt === 'object' ? auditOpt : {}
        const action = config.action || deriveAuditAction(req.method, pathname)
        const resourceType = config.resourceType || deriveResourceType(pathname)

        void writeAuditLog({
          organizationId: orgId,
          userId: ctx.userId,
          userEmail: ctx.email,
          action,
          resourceType,
          ipAddress: getIp(req),
        })
      }

      return response
    } catch (error) {
      const response = classifyError(error)
      // Log 5xx errors
      if (response.status >= 500) {
        log.error({ err: error }, `${req.method} ${routeLabel} failed`)
        Sentry.captureException(error)
      }
      return response
    }
  }

  // Cast: implementation accepts optional 2nd param, but Next.js route type-checks
  // require it to be non-optional. The cast satisfies generated .next/types/ files.
  return routeHandler as unknown as NextRouteHandler<TParams>
}
