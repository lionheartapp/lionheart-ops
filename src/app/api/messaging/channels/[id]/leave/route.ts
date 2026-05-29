/**
 * POST /api/messaging/channels/[id]/leave — leave a channel.
 * Cannot leave DM/GROUP_DM channels. Cannot leave if you're the sole owner.
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
    where: { id: channelId },
    select: { type: true },
  })

  if (!channel) {
    return NextResponse.json(fail('NOT_FOUND', 'Channel not found'), { status: 404 })
  }

  if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
    return NextResponse.json(fail('BAD_REQUEST', 'Cannot leave direct messages'), { status: 400 })
  }

  const membership = await prisma.channelMember.findFirst({
    where: { channelId, userId: ctx.userId },
  })

  if (!membership) {
    return NextResponse.json(fail('BAD_REQUEST', 'Not a member of this channel'), { status: 400 })
  }

  // Don't allow the sole owner to leave
  if (membership.role === 'owner') {
    const ownerCount = await prisma.channelMember.count({
      where: { channelId, role: 'owner' },
    })
    if (ownerCount <= 1) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'Cannot leave — you are the only owner. Transfer ownership first.'),
        { status: 400 },
      )
    }
  }

  await prisma.channelMember.deleteMany({
    where: { channelId, userId: ctx.userId },
  })

  return NextResponse.json(ok({ left: true }))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })
