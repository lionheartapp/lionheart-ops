/**
 * GET /api/conversations/[id]/messages — Get messages for a conversation
 *
 * Returns paginated messages for a conversation, ordered oldest first.
 * Verifies the conversation belongs to the current user's org.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { getConversation, getMessages } from '@/lib/services/ai/conversationService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = logger.child({ route: '/api/conversations/[id]/messages', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    const { id } = await params

    const url = new URL(req.url)
    const query = QuerySchema.parse({
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
    })

    return await runWithOrgContext(orgId, async () => {
      // Verify conversation belongs to current user's org
      const conversation = await getConversation(id, orgId)
      if (!conversation) {
        return NextResponse.json(fail('NOT_FOUND', 'Conversation not found'), { status: 404 })
      }

      const messages = await getMessages(id, {
        limit: query.limit,
        offset: query.offset,
      })

      return NextResponse.json(ok({ messages }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid query params', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to get conversation messages')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
