import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
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
  // Phase 1c Pass 5: AthleticTeam.schoolId was renamed to campusId.
  // Accept both for back-compat; createTeam service maps schoolId → campusId.
  campusId: z.string().optional(),
  schoolId: z.string().optional(),
  calendarId: z.string().optional(),
})

type Team = Awaited<ReturnType<typeof getTeams>>[number]

export const GET = withAuth(async ({ searchParams, ctx, permissions }) => {
  const canViewAll = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  const scope = searchParams.get('scope')
  const teams = await getTeams({
    sportId: searchParams.get('sportId') || undefined,
    seasonId: searchParams.get('seasonId') || undefined,
  })

  if (canViewAll) {
    return NextResponse.json(ok(teams))
  }

  const assignedTeams = teams.filter((team: Team) => team.coachUserId === ctx.userId)
  if (scope === 'sport') {
    const sportIds = new Set(assignedTeams.map((team: Team) => team.sport.id))
    return NextResponse.json(ok(teams.filter((team: Team) => sportIds.has(team.sport.id))))
  }

  return NextResponse.json(ok(assignedTeams))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ body }) => {
  const team = await createTeam(body)
  return NextResponse.json(ok(team), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_TEAMS_MANAGE, schema: CreateTeamSchema })
