import { NextRequest } from 'next/server'
import { verifyAuthToken } from '@/lib/auth'
import { rawPrisma } from '@/lib/db'
import {
  getCachedUserContext,
  setCachedUserContext,
} from '@/lib/cache/request-context-cache'

export type RequestContext = {
  userId: string
  organizationId: string
  email: string
  roleName: string | null
  /** Org's free-trial expiry — null for legacy orgs that predate trials. */
  orgTrialEndsAt: Date | null
  /** Latest subscription status on the org, if any. */
  orgSubscriptionStatus: string | null
}

/**
 * Extract and verify user context from request headers or cookies.
 *
 * Reads JWT from httpOnly auth-token cookie first, falls back to
 * Authorization: Bearer header.
 *
 * Uses rawPrisma to bypass org-scoping when looking up user by JWT.
 *
 * Performance: the DB-derived fields (roleName, trial, subscription) are cached
 * in-process for 60s per user. Invalidated explicitly on user/role/subscription
 * mutations via `invalidateUserContext(userId)`. The JWT-carried fields
 * (userId, organizationId, email) don't need caching — they're already signed.
 */
export async function getUserContext(req: NextRequest): Promise<RequestContext> {
  // Try cookie first (httpOnly cookie set by login endpoint)
  const cookieToken = req.cookies.get('auth-token')?.value
  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const token = cookieToken ?? bearerToken

  if (!token) {
    throw new Error('Missing or invalid authorization header')
  }
  const headerUserId = req.headers.get('x-auth-user-id')
  const headerOrgId = req.headers.get('x-org-id')
  const headerEmail = req.headers.get('x-auth-email')
  // Middleware verifies the JWT once and overwrites these internal headers.
  // If a route is ever called without those headers, fall back to verifying.
  const claims = headerUserId && headerOrgId && headerEmail
    ? { userId: headerUserId, organizationId: headerOrgId, email: headerEmail }
    : await verifyAuthToken(token)

  if (!claims) {
    throw new Error('Invalid or expired token')
  }

  // Hot path — return early if the DB-derived fields are cached for this user.
  const cached = getCachedUserContext(claims.userId)
  if (cached) {
    return {
      userId: claims.userId,
      organizationId: claims.organizationId,
      email: claims.email,
      roleName: cached.roleName,
      orgTrialEndsAt: cached.orgTrialEndsAt,
      orgSubscriptionStatus: cached.orgSubscriptionStatus,
    }
  }

  const user = await rawPrisma.user.findUnique({
    where: { id: claims.userId },
    select: {
      id: true,
      email: true,
      organizationId: true,
      userRole: { select: { name: true } },
      organization: {
        select: {
          trialEndsAt: true,
          subscriptions: {
            select: { status: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  const roleName = user.userRole?.name ?? null
  const orgTrialEndsAt = user.organization?.trialEndsAt ?? null
  const orgSubscriptionStatus = user.organization?.subscriptions[0]?.status ?? null

  setCachedUserContext(claims.userId, {
    roleName,
    orgTrialEndsAt,
    orgSubscriptionStatus,
  })

  return {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    roleName,
    orgTrialEndsAt,
    orgSubscriptionStatus,
  }
}
