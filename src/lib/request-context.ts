import { NextRequest } from 'next/server'
import { verifyAuthToken, AuthClaims } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { UserRole } from '@prisma/client'

// Use raw Prisma client to avoid org-scoping issues when fetching user by JWT
const rawPrisma = new PrismaClient()

export type RequestContext = {
  userId: string
  organizationId: string
  email: string
  role: UserRole
}

/**
 * Extract and verify user context from request headers
 * Expects Authorization: Bearer <token> header
 * @param req NextRequest
 * @returns User context with role
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

  // Fetch user to get role using raw Prisma (no org scoping)
  const user = await rawPrisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, role: true, email: true, organizationId: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    role: user.role,
  }
}
