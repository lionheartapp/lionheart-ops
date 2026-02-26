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
 * Extract and verify user context from request headers.
 * Expects Authorization: Bearer <token> header.
 * Uses rawPrisma to bypass org-scoping when looking up user by JWT.
 */
export async function getUserContext(req: NextRequest): Promise<RequestContext> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header')
  }

  const token = authHeader.slice(7)
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
