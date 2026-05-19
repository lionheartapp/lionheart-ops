import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

const CreateFeedSchema = z.object({
  feedType: z.enum(['team', 'team-public', 'space', 'user']),
  entityId: z.string().optional(),
})

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_FEED_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const feeds = await prisma.calendarFeed.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json(ok(feeds))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_FEED_MANAGE)

    const body = await req.json()
    const parsed = CreateFeedSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request', parsed.error.flatten().fieldErrors),
        { status: 400 },
      )
    }

    const { feedType, entityId } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      // Check if feed already exists for this user + type + entity
      const existing = await prisma.calendarFeed.findFirst({
        where: {
          userId: feedType === 'team-public' ? null : ctx.userId,
          feedType,
          entityId: entityId ?? null,
          isActive: true,
        },
      })

      if (existing) {
        // Return existing feed URL
        return NextResponse.json(ok(existing))
      }

      const feed = await prisma.calendarFeed.create({
        data: {
          organizationId: orgId,
          userId: feedType === 'team-public' ? null : ctx.userId,
          feedType,
          entityId: entityId ?? null,
          token: generateToken(),
        },
      })

      return NextResponse.json(ok(feed), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_FEED_MANAGE)

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'id is required'), { status: 400 })
    }

    return await runWithOrgContext(orgId, async () => {
      // Revoke by setting isActive = false (keeps the record for audit)
      await prisma.calendarFeed.update({
        where: { id },
        data: { isActive: false },
      })

      return NextResponse.json(ok({ revoked: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
