/**
 * GET /api/conversations — List Leo conversations for the current user
 *
 * Returns a paginated list of conversations ordered by most recently updated.
 * Each conversation includes id, title, updatedAt, and messageCount.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { getConversations } from '@/lib/services/ai/conversationService'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const GET = withAuth(async ({ ctx, orgId, searchParams }) => {
  const query = QuerySchema.parse({
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })

  const conversations = await getConversations(ctx.userId, orgId, {
    limit: query.limit,
    offset: query.offset,
  })

  return NextResponse.json(ok({ conversations, total: conversations.length }))
})
