import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTeamById, updateTeam, deleteTeam } from '@/lib/services/athleticsService'

const UpdateTeamSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  level: z.enum(['VARSITY', 'VARSITY_B', 'JUNIOR_VARSITY', 'FRESHMAN', 'FROSH_SOPH', 'C_TEAM', 'CLUB', 'INTRAMURAL', 'UNIFIED']).optional(),
  gradeLevel: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).nullable().optional(),
  coachUserId: z.string().nullable().optional(),
  coachName: z.string().trim().max(200).nullable().optional(),
  schoolId: z.string().nullable().optional(),
  calendarId: z.string().nullable().optional(),
})

export const GET = withAuth(async ({ params }) => {
  const team = await getTeamById(params.id)
  if (!team) return NextResponse.json(fail('NOT_FOUND', 'Team not found'), { status: 404 })
  return NextResponse.json(ok(team))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const PUT = withAuth(async ({ params, body }) => {
  const team = await updateTeam(params.id, body)
  return NextResponse.json(ok(team))
}, { permission: PERMISSIONS.ATHLETICS_TEAMS_MANAGE, schema: UpdateTeamSchema })

export const DELETE = withAuth(async ({ params }) => {
  await deleteTeam(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ATHLETICS_TEAMS_MANAGE })
