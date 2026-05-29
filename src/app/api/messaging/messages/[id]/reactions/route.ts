/**
 * POST /api/messaging/messages/[id]/reactions — toggle reaction on a message (D-03)
 *
 * T-27-01: Emoji validated via Zod (1-32 chars). Channel membership verified in service.
 * T-27-03: userId from JWT, never client-supplied.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { toggleReaction, ToggleReactionSchema } from '@/lib/services/reactionService'

export const POST = withAuth<z.infer<typeof ToggleReactionSchema>, { id: string }>(
  async ({ ctx, orgId, params, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked
    const result = await toggleReaction(params.id, ctx.userId, body.emoji)
    return NextResponse.json(ok(result))
  },
  { permission: PERMISSIONS.MESSAGING_ACCESS, schema: ToggleReactionSchema },
)
