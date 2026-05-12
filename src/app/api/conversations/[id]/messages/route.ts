/**
 * GET /api/conversations/[id]/messages — Get messages for a conversation
 *
 * Returns paginated messages for a conversation, ordered oldest first.
 * Verifies the conversation belongs to the current user's org.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { getConversation, getMessages } from '@/lib/services/ai/conversationService'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const GET = withAuth(async ({ orgId, ctx, params, searchParams }) => {
  const query = QuerySchema.parse({
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })

  // Verify conversation belongs to current user's org
  const conversation = await getConversation(params.id, orgId, ctx.userId)
  if (!conversation) {
    return NextResponse.json(fail('NOT_FOUND', 'Conversation not found'), { status: 404 })
  }

  const messages = await getMessages(params.id, {
    limit: query.limit,
    offset: query.offset,
  })

  return NextResponse.json(ok({ messages }))
})
