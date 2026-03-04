import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getRoster, createRosterPlayer } from '@/lib/services/athleticsService'

const CreateSchema = z.object({
  athleticTeamId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  jerseyNumber: z.string().optional(),
  position: z.string().optional(),
  grade: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  userId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)

    const teamId = req.nextUrl.searchParams.get('teamId') || undefined
    const isActive = req.nextUrl.searchParams.get('isActive')

    return await runWithOrgContext(orgId, async () => {
      const roster = await getRoster({
        teamId,
        isActive: isActive != null ? isActive === 'true' : undefined,
      })
      return NextResponse.json(ok(roster))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch roster'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_ROSTER_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateSchema.parse(body)
      const player = await createRosterPlayer(input)
      return NextResponse.json(ok(player), { status: 201 })
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
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create roster player'), { status: 500 })
  }
}
