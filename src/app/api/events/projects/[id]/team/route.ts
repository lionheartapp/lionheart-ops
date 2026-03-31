import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { listTeamMembers, addTeamMember } from '@/lib/services/eventTeamService'
import { AddEventTeamMemberSchema } from '@/lib/types/event-project'

/**
 * GET /api/events/projects/[id]/team
 *
 * Returns all team members for an EventProject.
 */
export const GET = withAuth(async ({ params }) => {
  const members = await listTeamMembers(params.id)
  return NextResponse.json(ok(members))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

/**
 * POST /api/events/projects/[id]/team
 *
 * Adds a user to the event's team.
 * Returns 409 if user is already a team member.
 */
export const POST = withAuth(async ({ req, ctx, params }) => {
  const body = await req.json()
  const validated = AddEventTeamMemberSchema.parse(body)
  const member = await addTeamMember(params.id, validated, ctx.userId)
  return NextResponse.json(ok(member), { status: 201 })
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL })
