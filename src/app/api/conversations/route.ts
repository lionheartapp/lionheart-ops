/**
 * GET /api/conversations — List Leo conversations for the current user
 *
 * Returns a paginated list of conversations ordered by most recently updated.
 * Each conversation includes id, title, updatedAt, and messageCount.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { getConversations } from '@/lib/services/ai/conversationService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/conversations', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    const url = new URL(req.url)
    const query = QuerySchema.parse({
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
    })

    return await runWithOrgContext(orgId, async () => {
      const conversations = await getConversations(ctx.userId, orgId, {
        limit: query.limit,
        offset: query.offset,
      })

      return NextResponse.json(ok({ conversations, total: conversations.length }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid query params', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to list conversations')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
