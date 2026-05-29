import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext } from '@/lib/org-context'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { audit, getIp } from '@/lib/services/auditService'

const AvatarUpdateSchema = z.object({
  avatar: z.string().nullable().optional().refine(
    (val) => !val || val.startsWith('data:image/') || val.startsWith('http'),
    'Avatar must be a data URL or valid image URL'
  ),
})

export async function PATCH(request: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(request)
    const ctx = await getUserContext(request)

    if (!ctx?.userId || !orgId) {
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Not authenticated'),
        { status: 401 }
      )
    }

    const userId = ctx.userId
    const organizationId = orgId

    let body: unknown
    try {
      body = await request.json()
    } catch (err) {
      logger.error({ error: String(err) }, 'JSON parse error')
      return NextResponse.json(
        fail('INVALID_JSON', 'Invalid JSON in request body'),
        { status: 400 }
      )
    }

    const input = AvatarUpdateSchema.parse(body)

    return await runWithOrgContext(organizationId, async () => {
      const existingUser = await prisma.user.findFirst({
        where: { id: userId },
        select: { email: true },
      })

      if (!existingUser) {
        return NextResponse.json(
          fail('NOT_FOUND', 'User not found'),
          { status: 404 }
        )
      }

      const user = await prisma.user.update({
        where: {
          organizationId_email: {
            organizationId,
            email: existingUser.email,
          },
        },
        data: {
          avatar: input.avatar ?? null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
        },
      })

      logger.info({ userId }, 'Updated avatar for user')

      void audit({
        organizationId,
        userId,
        userEmail: user.email,
        action: 'user.avatar_update',
        resourceType: 'User',
        resourceId: userId,
        resourceLabel: user.email,
        ipAddress: getIp(request),
      })

      return NextResponse.json(
        ok({
          user,
        })
      )
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      logger.error({ error: JSON.stringify(err.issues) }, 'Validation error')
      return NextResponse.json(
        fail('INVALID_INPUT', err.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    logger.error({ error: String(err) }, 'Avatar update error')
    return NextResponse.json(
      fail('INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Failed to update avatar'),
      { status: 500 }
    )
  }
}
