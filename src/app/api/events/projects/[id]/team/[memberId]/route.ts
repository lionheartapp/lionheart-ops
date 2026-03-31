import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateTeamMember, removeTeamMember } from '@/lib/services/eventTeamService'
import { UpdateEventTeamMemberSchema } from '@/lib/types/event-project'

/**
 * PATCH /api/events/projects/[id]/team/[memberId]
 *
 * Updates a team member's role or notes.
 */
export const PATCH = withAuth(async ({ req, ctx, params }) => {
  const body = await req.json()
  const validated = UpdateEventTeamMemberSchema.parse(body)
  const updated = await updateTeamMember(params.memberId, validated, ctx.userId, params.id)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL })

/**
 * DELETE /api/events/projects/[id]/team/[memberId]
 *
 * Removes a team member (hard delete).
 */
export const DELETE = withAuth(async ({ ctx, params }) => {
  await removeTeamMember(params.memberId, ctx.userId, params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL })
