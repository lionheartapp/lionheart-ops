import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { respondToInvitation } from '@/lib/services/eventInvitationService'
import { z } from 'zod'

const RespondSchema = z.object({
  status: z.enum(['ACCEPTED', 'MAYBE', 'DECLINED']),
  responseNote: z.string().max(500).optional(),
})

/**
 * POST /api/events/projects/[id]/invitations/respond
 *
 * Allows the current user to accept, maybe, or decline their invitation.
 * No special permission needed — any authenticated user can respond to their own invitation.
 */
export const POST = withAuth(async ({ ctx, params, body }) => {
  const result = await respondToInvitation(
    params.id,
    ctx.userId,
    body.status,
    body.responseNote,
  )
  return NextResponse.json(ok(result))
}, { schema: RespondSchema })
