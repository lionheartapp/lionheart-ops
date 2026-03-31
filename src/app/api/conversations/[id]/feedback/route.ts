/**
 * POST /api/conversations/[id]/feedback — Submit feedback on a conversation message
 *
 * Accepts a messageId and score (1-5). Verifies the message belongs to a
 * conversation in the current user's org before updating.
 *
 * Score conventions: 1 = thumbs down, 5 = thumbs up.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { setMessageFeedback } from '@/lib/services/ai/conversationService'
import { rawPrisma } from '@/lib/db'

const FeedbackSchema = z.object({
  messageId: z.string().min(1),
  score: z.number().int().min(1).max(5),
})

export const POST = withAuth(async ({ orgId, params, body }) => {
  // Verify the message belongs to a conversation in this user's org
  const message = await rawPrisma.conversationMessage.findFirst({
    where: {
      id: body.messageId,
      conversationId: params.id,
      organizationId: orgId,
    },
    select: { id: true },
  })

  if (!message) {
    return NextResponse.json(fail('NOT_FOUND', 'Message not found'), { status: 404 })
  }

  await setMessageFeedback(body.messageId, body.score)
  return NextResponse.json(ok({ updated: true }))
}, { schema: FeedbackSchema })
