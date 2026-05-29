import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

/**
 * PATCH /api/messaging/channels/[id]/read
 *
 * Marks the current user's channel membership as read by updating lastReadAt.
 * The Phase 23 Postgres trigger `reset_unread_on_read` automatically sets
 * unreadCount = 0 when lastReadAt is updated.
 *
 * If the user isn't a member yet (e.g. viewing a public channel for the first
 * time), this is a no-op rather than a 404.
 */
export const PATCH = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked

  const channelId = params.id

  // Use updateMany to avoid throwing when the membership doesn't exist yet
  await prisma.channelMember.updateMany({
    where: {
      channelId,
      userId: ctx.userId,
    },
    data: {
      lastReadAt: new Date(),
    },
  })

  return NextResponse.json(ok({ success: true }))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })
