import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getBlackoutDates, addBlackoutDate, removeBlackoutDate } from '@/lib/services/planningSeasonService'

const AddBlackoutSchema = z.object({
  date: z.string().transform((s) => new Date(s)),
  reason: z.string().optional(),
})

const DeleteBlackoutSchema = z.object({
  blackoutDateId: z.string().min(1),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_VIEW)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const dates = await getBlackoutDates(id)
      return NextResponse.json(ok(dates))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch blackout dates'), { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = AddBlackoutSchema.parse(body)
      const date = await addBlackoutDate({ planningSeasonId: id, ...input })
      return NextResponse.json(ok(date), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to add blackout date'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const { blackoutDateId } = DeleteBlackoutSchema.parse(body)
      await removeBlackoutDate(blackoutDateId)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to remove blackout date'), { status: 500 })
  }
}
