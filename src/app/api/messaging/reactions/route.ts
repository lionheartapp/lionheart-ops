/**
 * GET /api/messaging/reactions?messageId=...&messageId=...
 *
 * Batch-fetch reactions for multiple messages. Used by useReactions hook
 * to efficiently load reaction data for visible messages.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { getReactionsForMessages } from '@/lib/services/reactionService'

export const GET = withAuth(async ({ ctx, orgId, searchParams }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked

  const messageIds = searchParams.getAll('messageId').filter(Boolean)
  if (messageIds.length === 0) {
    return NextResponse.json(ok({}))
  }

  // Cap at 100 to prevent abuse
  const capped = messageIds.slice(0, 100)
  const reactions = await getReactionsForMessages(capped, ctx.userId)
  return NextResponse.json(ok(reactions))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })
