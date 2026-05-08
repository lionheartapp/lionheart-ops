/**
 * POST /api/messaging/channels/[id]/leave — leave a channel.
 * Cannot leave DM/GROUP_DM channels. Cannot leave if you're the sole owner.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'

export const POST = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked

  const channelId = params.id

  const channel = await rawPrisma.channel.findUnique({
    where: { id: channelId, organizationId: orgId, deletedAt: null },
    select: { type: true },
  })

  if (!channel) {
    return NextResponse.json(fail('NOT_FOUND', 'Channel not found'), { status: 404 })
  }

  if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
    return NextResponse.json(fail('BAD_REQUEST', 'Cannot leave direct messages'), { status: 400 })
  }

  const membership = await rawPrisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: ctx.userId } },
  })

  if (!membership) {
    return NextResponse.json(fail('BAD_REQUEST', 'Not a member of this channel'), { status: 400 })
  }

  // Don't allow the sole owner to leave
  if (membership.role === 'owner') {
    const ownerCount = await rawPrisma.channelMember.count({
      where: { channelId, role: 'owner' },
    })
    if (ownerCount <= 1) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'Cannot leave — you are the only owner. Transfer ownership first.'),
        { status: 400 },
      )
    }
  }

  await rawPrisma.channelMember.delete({
    where: { channelId_userId: { channelId, userId: ctx.userId } },
  })

  return NextResponse.json(ok({ left: true }))
})
