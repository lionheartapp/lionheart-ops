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

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.message.toLowerCase().includes('not found')
}

function isPrismaUniqueConstraint(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
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

  // Prisma unique constraint → 409
  if (isPrismaUniqueConstraint(error)) {
    const target = (error as { meta?: { target?: string[] } }).meta?.target
    const field = target?.[0] ?? 'value'
    return NextResponse.json(
      fail('CONFLICT', `A record with that ${field} already exists`),
      { status: 409 }
    )
  }

  // Catch-all → 500 (never leak internal error details to clients)
  return NextResponse.json(
    fail('INTERNAL_ERROR', 'Internal server error'),
    { status: 500 }
  )
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

      return await runWithOrgContext(orgId, () =>
        handler({ req, orgId, ctx, body, params, searchParams, permissions })
      )
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
