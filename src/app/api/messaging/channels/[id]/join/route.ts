/**
 * POST /api/messaging/channels/[id]/join — join a public channel.
 * Any authenticated user can join a public channel.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'

export const POST = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked

  const channel = await rawPrisma.channel.findUnique({
    where: { id: params.id, organizationId: orgId, deletedAt: null },
    select: { type: true },
  })

  if (!channel) {
    return NextResponse.json(fail('NOT_FOUND', 'Channel not found'), { status: 404 })
  }

  if (channel.type !== 'PUBLIC') {
    return NextResponse.json(fail('BAD_REQUEST', 'Can only join public channels'), { status: 400 })
  }

  await rawPrisma.channelMember.upsert({
    where: { channelId_userId: { channelId: params.id, userId: ctx.userId } },
    create: { channelId: params.id, userId: ctx.userId, organizationId: orgId, role: 'member' },
    update: {},
  })

  return NextResponse.json(ok({ joined: true }))
})
