/**
 * POST /api/conversations/[id]/feedback — Submit feedback on a conversation message
 *
 * Accepts a messageId and score (1-5). Verifies the message belongs to a
 * conversation in the current user's org before updating.
 *
 * Score conventions: 1 = thumbs down, 5 = thumbs up.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { setMessageFeedback } from '@/lib/services/ai/conversationService'
import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const FeedbackSchema = z.object({
  messageId: z.string().min(1),
  score: z.number().int().min(1).max(5),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = logger.child({ route: '/api/conversations/[id]/feedback', method: 'POST' })
  try {
    const orgId = getOrgIdFromRequest(req)
    await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    const { id } = await params
    const body = FeedbackSchema.parse(await req.json())

    return await runWithOrgContext(orgId, async () => {
      // Verify the message belongs to a conversation in this user's org
      const message = await rawPrisma.conversationMessage.findFirst({
        where: {
          id: body.messageId,
          conversationId: id,
          organizationId: orgId,
        },
        select: { id: true },
      })

      if (!message) {
        return NextResponse.json(fail('NOT_FOUND', 'Message not found'), { status: 404 })
      }

      await setMessageFeedback(body.messageId, body.score)
      return NextResponse.json(ok({ updated: true }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to submit message feedback')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
