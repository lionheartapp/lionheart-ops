import { NextRequest, NextResponse } from 'next/server'
import { prisma, rawPrisma } from '@/lib/db'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext } from '@/lib/org-context'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { audit, getIp } from '@/lib/services/auditService'

const ProfileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().max(100).optional().nullable(),
})

export async function PATCH(request: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(request)
    const ctx = await getUserContext(request)

    if (!ctx?.userId || !orgId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const userId = ctx.userId
    const organizationId = orgId

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(fail('INVALID_JSON', 'Invalid JSON in request body'), { status: 400 })
    }

    const input = ProfileUpdateSchema.parse(body)

    return await runWithOrgContext(organizationId, async () => {
      // rawPrisma for the id-only lookup — org-scoped findUnique by id alone
      // produces an AND clause that Prisma rejects (needs a unique key).
      const existing = await rawPrisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      })

      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
      }

      // Build the full name from first + last for the `name` field
      const firstName = input.firstName ?? existing.firstName ?? ''
      const lastName = input.lastName !== undefined ? input.lastName : existing.lastName
      const name = [firstName, lastName].filter(Boolean).join(' ') || firstName

      const user = await prisma.user.update({
        where: {
          organizationId_email: { organizationId, email: existing.email },
        },
        data: {
          firstName,
          lastName: lastName ?? null,
          name,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      })

      void audit({
        organizationId,
        userId,
        userEmail: user.email,
        action: 'user.profile_update',
        resourceType: 'User',
        resourceId: userId,
        resourceLabel: user.email,
        ipAddress: getIp(request),
      })

      return NextResponse.json(ok({ user }))
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', err.issues[0]?.message || 'Invalid input'), { status: 400 })
    }
    logger.error({ error: String(err) }, 'Profile update failed')
    return NextResponse.json(
      fail('INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Failed to update profile'),
      { status: 500 },
    )
  }
}
