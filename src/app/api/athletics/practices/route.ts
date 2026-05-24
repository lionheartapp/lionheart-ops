import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getPractices, getTeams, createPractice } from '@/lib/services/athleticsService'

const CreatePracticeSchema = z.object({
  athleticTeamId: z.string().min(1),
  startTime: z.string().transform((s) => new Date(s)),
  endTime: z.string().transform((s) => new Date(s)),
  location: z.string().optional(),
  notes: z.string().optional(),
  rrule: z.string().optional(),
  calendarId: z.string().optional(),
  // Facility booking fields (passed through to CalendarEvent)
  spaceId: z.string().optional(),
  buildingId: z.string().optional(),
  setupMinutes: z.number().int().min(0).max(120).optional(),
  teardownMinutes: z.number().int().min(0).max(120).optional(),
  description: z.string().optional(),
})

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Practice = Awaited<ReturnType<typeof getPractices>>[number]

export const GET = withAuth(async ({ searchParams, ctx, permissions }) => {
  const [practices, teams] = await Promise.all([
    getPractices({ teamId: searchParams.get('teamId') || undefined }),
    getTeams(),
  ])

  const canViewAll = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (canViewAll) return NextResponse.json(ok(practices))

  const assignedTeams = teams.filter((team: Team) => team.coachUserId === ctx.userId)
  const assignedTeamIds = new Set(assignedTeams.map((team: Team) => team.id))
  const assignedSportIds = new Set(assignedTeams.map((team: Team) => team.sport.id))
  const visibleTeamIds = searchParams.get('scope') === 'sport'
    ? new Set(teams.filter((team: Team) => assignedSportIds.has(team.sport.id)).map((team: Team) => team.id))
    : assignedTeamIds

  return NextResponse.json(ok(practices.filter((practice: Practice) => visibleTeamIds.has(practice.athleticTeamId))))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const POST = withAuth(async ({ body, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams) {
    const teams = await getTeams()
    const team = teams.find((item: Team) => item.id === body.athleticTeamId)
    if (!team || team.coachUserId !== ctx.userId) {
      return NextResponse.json(fail('FORBIDDEN', 'Coaches can only schedule practices for assigned teams'), { status: 403 })
    }
  }
  const { calendarId, ...input } = body
  const practice = await createPractice(input, calendarId ? { calendarId } : undefined)
  return NextResponse.json(ok(practice), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_PRACTICES_CREATE, schema: CreatePracticeSchema })
