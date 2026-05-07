/**
 * GET /api/messaging/search?q=term&channelId=optional&limit=20&cursor=msgId
 *
 * Full-text search across messages in channels the user belongs to (T-24-21).
 * Search term is sanitized in the service layer (T-24-22).
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import {
  searchMessages,
  SearchQuerySchema,
} from '@/lib/services/messageService'

// GET /api/messaging/search — full-text search scoped to user's channels
export const GET = withAuth(async ({ ctx, orgId, searchParams }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked
  const query = SearchQuerySchema.parse({
    q: searchParams.get('q') ?? '',
    channelId: searchParams.get('channelId') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
  })
  const result = await searchMessages(ctx.userId, query)
  return NextResponse.json(ok(result.results, {
    hasMore: result.hasMore,
    cursor: result.cursor,
  }))
})
