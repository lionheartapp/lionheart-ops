/**
 * GET /api/messaging/users — search org members for messaging.
 *
 * Lightweight endpoint any authenticated user can hit (no special permission).
 * Returns minimal user data: id, firstName, lastName, email, avatar.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { ok } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'

export const GET = withAuth(async ({ orgId, ctx, searchParams }) => {
  const search = searchParams.get('search') || ''
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  const where: Record<string, unknown> = {
    organizationId: orgId,
    deletedAt: null,
    status: 'ACTIVE',
    id: { not: ctx.userId },
    email: { not: { endsWith: '@lionheart.internal' } },
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  const users = await rawPrisma.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatar: true,
    },
    orderBy: { firstName: 'asc' },
    take: limit,
  })

  return NextResponse.json(ok(users))
})
