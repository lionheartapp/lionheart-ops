import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'

const CreateSchema = z
  .object({
    date: z.string().datetime(),
    reason: z.string().optional(),
    appliesToAll: z.boolean().default(true),
    spaceId: z.string().optional(),
  })
  .refine((d) => !d.appliesToAll || !d.spaceId, {
    message: 'Cannot set a specific space when appliesToAll is true',
  })

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FACILITIES_VIEW_SCHEDULE)

    return await runWithOrgContext(orgId, async () => {
      const dates = await prisma.blackoutDate.findMany({
        orderBy: { date: 'asc' },
        include: {
          space: { select: { id: true, name: true } },
        },
      })

      return NextResponse.json(ok(dates))
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
    await assertCan(ctx.userId, PERMISSIONS.FACILITIES_MANAGE_HOURS)

    const body = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const blackout = await prisma.blackoutDate.create({
        data: {
          organizationId: orgId,
          date: new Date(parsed.data.date),
          reason: parsed.data.reason,
          appliesToAll: parsed.data.appliesToAll,
          spaceId: parsed.data.spaceId,
        },
        include: {
          space: { select: { id: true, name: true } },
        },
      })

      return NextResponse.json(ok(blackout), { status: 201 })
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
    await assertCan(ctx.userId, PERMISSIONS.FACILITIES_MANAGE_HOURS)

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'id is required'), { status: 400 })
    }

    return await runWithOrgContext(orgId, async () => {
      await prisma.blackoutDate.delete({ where: { id } })
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
