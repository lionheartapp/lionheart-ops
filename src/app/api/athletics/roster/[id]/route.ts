import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getRosterPlayer, updateRosterPlayer, deleteRosterPlayer } from '@/lib/services/athleticsService'

const UpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  jerseyNumber: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  height: z.string().nullable().optional(),
  weight: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const player = await getRosterPlayer(id)
      if (!player) {
        return NextResponse.json(fail('NOT_FOUND', 'Player not found'), { status: 404 })
      }
      return NextResponse.json(ok(player))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch player'), { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_ROSTER_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = UpdateSchema.parse(body)
      const player = await updateRosterPlayer(id, input)
      return NextResponse.json(ok(player))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(fail('CONFLICT', 'Jersey number already in use on this team'), { status: 409 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update player'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_ROSTER_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      await deleteRosterPlayer(id)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete player'), { status: 500 })
  }
}
