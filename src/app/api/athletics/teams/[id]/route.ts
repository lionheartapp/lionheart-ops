import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getTeamById, updateTeam, deleteTeam } from '@/lib/services/athleticsService'

const UpdateTeamSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  level: z.enum(['VARSITY', 'JUNIOR_VARSITY', 'FRESHMAN', 'MIDDLE_SCHOOL']).optional(),
  coachUserId: z.string().nullable().optional(),
  schoolId: z.string().nullable().optional(),
  calendarId: z.string().nullable().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const team = await getTeamById(id)
      if (!team) return NextResponse.json(fail('NOT_FOUND', 'Team not found'), { status: 404 })
      return NextResponse.json(ok(team))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch team'), { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = UpdateTeamSchema.parse(body)
      const team = await updateTeam(id, input)
      return NextResponse.json(ok(team))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update team'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      await deleteTeam(id)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete team'), { status: 500 })
  }
}
