import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getEventInvitations,
  createEventInvitations,
} from '@/lib/services/eventInvitationService'
import { z } from 'zod'

const CreateInvitationsSchema = z.object({
  userIds: z.array(z.string()).min(1),
  note: z.string().optional(),
})

/**
 * GET /api/events/projects/[id]/invitations
 *
 * Returns all invitations for an event with user details and RSVP status.
 */
export const GET = withAuth(async ({ params }) => {
  const invitations = await getEventInvitations(params.id)
  return NextResponse.json(ok(invitations))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

/**
 * POST /api/events/projects/[id]/invitations
 *
 * Creates invitations for the given user IDs.
 */
export const POST = withAuth(async ({ ctx, params, body }) => {
  await createEventInvitations(params.id, body.userIds, ctx.userId, body.note)
  const invitations = await getEventInvitations(params.id)
  return NextResponse.json(ok(invitations), { status: 201 })
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: CreateInvitationsSchema })
