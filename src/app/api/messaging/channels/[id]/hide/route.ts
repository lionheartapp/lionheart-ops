/**
 * POST /api/messaging/channels/[id]/hide — hide a DM for the current user.
 *
 * Sets hiddenAt on the ChannelMember row so the DM disappears from the sidebar
 * without removing the user from the conversation. When the same DM is found
 * again (e.g. via new message compose), hiddenAt is cleared to resurface it.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

export const POST = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked

  const channelId = params.id

  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      members: { some: { userId: ctx.userId } },
    },
    select: { type: true },
  })

  if (!channel) {
    return NextResponse.json(fail('NOT_FOUND', 'Channel not found'), { status: 404 })
  }

  if (channel.type !== 'DM' && channel.type !== 'GROUP_DM') {
    return NextResponse.json(fail('BAD_REQUEST', 'Only DM channels can be hidden'), { status: 400 })
  }

  // Set hiddenAt — keeps membership intact, just hides from sidebar
  await prisma.channelMember.updateMany({
    where: { channelId, userId: ctx.userId },
    data: { hiddenAt: new Date() },
  })

  return NextResponse.json(ok({ hidden: true }))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })
