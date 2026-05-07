import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { prisma } from '@/lib/db'

/**
 * PATCH /api/messaging/channels/[id]/read
 *
 * Marks the current user's channel membership as read by updating lastReadAt.
 * The Phase 23 Postgres trigger `reset_unread_on_read` automatically sets
 * unreadCount = 0 when lastReadAt is updated.
 */
export const PATCH = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked

  const channelId = params.id

  // Update lastReadAt — Postgres trigger resets unreadCount automatically
  await prisma.channelMember.update({
    where: {
      channelId_userId: {
        channelId,
        userId: ctx.userId,
      },
    },
    data: {
      lastReadAt: new Date(),
    },
  })

  return NextResponse.json(ok({ success: true }))
})
