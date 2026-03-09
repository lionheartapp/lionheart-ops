import { NextRequest } from 'next/server'
import { verifyAuthToken } from '@/lib/auth'
import { rawPrisma } from '@/lib/db'

export type RequestContext = {
  userId: string
  organizationId: string
  email: string
  roleName: string | null
}

/**
 * Extract and verify user context from request headers or cookies.
 * Reads JWT from httpOnly auth-token cookie first, falls back to Authorization: Bearer header.
 * Uses rawPrisma to bypass org-scoping when looking up user by JWT.
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
  const claims = await verifyAuthToken(token)

  if (!claims) {
    throw new Error('Invalid or expired token')
  }

  const user = await rawPrisma.user.findUnique({
    where: { id: claims.userId },
    select: {
      id: true,
      email: true,
      organizationId: true,
      userRole: { select: { name: true } },
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    roleName: user.userRole?.name ?? null,
  }
}
