/**
 * POST /api/messaging/channels/[id]/join — join a public channel.
 * Any authenticated user can join a public channel.
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

  const channel = await prisma.channel.findFirst({
    where: { id: params.id },
    select: { type: true },
  })

  if (!channel) {
    return NextResponse.json(fail('NOT_FOUND', 'Channel not found'), { status: 404 })
  }

  if (channel.type !== 'PUBLIC') {
    return NextResponse.json(fail('BAD_REQUEST', 'Can only join public channels'), { status: 400 })
  }

  const existingMembership = await prisma.channelMember.findFirst({
    where: { channelId: params.id, userId: ctx.userId },
    select: { id: true },
  })

  if (!existingMembership) {
    await prisma.channelMember.create({
      data: { channelId: params.id, userId: ctx.userId, organizationId: orgId, role: 'member' },
    })
  }

  return NextResponse.json(ok({ joined: true }))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })
