import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getTeams, createTeam } from '@/lib/services/athleticsService'

const CreateTeamSchema = z.object({
  sportId: z.string().min(1),
  seasonId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  level: z.enum(['VARSITY', 'VARSITY_B', 'JUNIOR_VARSITY', 'FRESHMAN', 'FROSH_SOPH', 'C_TEAM', 'CLUB', 'INTRAMURAL', 'UNIFIED']).optional(),
  gradeLevel: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).nullable().optional(),
  coachUserId: z.string().optional(),
  coachName: z.string().trim().max(200).optional(),
  schoolId: z.string().optional(),
  calendarId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const teams = await getTeams({
        sportId: searchParams.get('sportId') || undefined,
        seasonId: searchParams.get('seasonId') || undefined,
      })
      return NextResponse.json(ok(teams))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch teams'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_TEAMS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateTeamSchema.parse(body)
      const team = await createTeam(input)
      return NextResponse.json(ok(team), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create team'), { status: 500 })
  }
}
