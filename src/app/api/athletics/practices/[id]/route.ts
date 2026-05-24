import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getPractices, getTeams, updatePractice, deletePractice } from '@/lib/services/athleticsService'

const UpdatePracticeSchema = z.object({
  startTime: z.string().transform((s) => new Date(s)).optional(),
  endTime: z.string().transform((s) => new Date(s)).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  rrule: z.string().nullable().optional(),
})

type Team = Awaited<ReturnType<typeof getTeams>>[number]
type Practice = Awaited<ReturnType<typeof getPractices>>[number]

async function coachCanAccessPractice(practiceId: string, userId: string) {
  const [practices, teams] = await Promise.all([getPractices(), getTeams()])
  const practice = practices.find((item: Practice) => item.id === practiceId)
  const assignedTeamIds = new Set(teams.filter((team: Team) => team.coachUserId === userId).map((team: Team) => team.id))
  return Boolean(practice && assignedTeamIds.has(practice.athleticTeamId))
}

export const PUT = withAuth(async ({ params, body, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams && !(await coachCanAccessPractice(params.id, ctx.userId))) {
    return NextResponse.json(fail('FORBIDDEN', 'Coaches can only update assigned team practices'), { status: 403 })
  }
  const practice = await updatePractice(params.id, body)
  return NextResponse.json(ok(practice))
}, { permission: PERMISSIONS.ATHLETICS_PRACTICES_CREATE, schema: UpdatePracticeSchema })

export const DELETE = withAuth(async ({ params, ctx, permissions }) => {
  const canManageTeams = await permissions.can(PERMISSIONS.ATHLETICS_TEAMS_MANAGE)
  if (!canManageTeams && !(await coachCanAccessPractice(params.id, ctx.userId))) {
    return NextResponse.json(fail('FORBIDDEN', 'Coaches can only delete assigned team practices'), { status: 403 })
  }
  await deletePractice(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ATHLETICS_PRACTICES_CREATE })
