/**
 * POST /api/messaging/channels/[id]/mute — toggle mute on a channel (D-11)
 *
 * Sets or clears mutedAt on the ChannelMember row for the current user.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

export const POST = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked

  const db = prisma as unknown as OrgPrismaClient

  // Look up current membership
  const membership = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId: params.id, userId: ctx.userId } },
  })
  if (!membership) throw new Error('Not a member of this channel')

  const isMuted = !!(membership as Record<string, unknown>).mutedAt

  // Toggle: if muted, unmute; if unmuted, mute
  await db.channelMember.update({
    where: { channelId_userId: { channelId: params.id, userId: ctx.userId } },
    data: { mutedAt: isMuted ? null : new Date() },
  })

  return NextResponse.json(ok({ muted: !isMuted }))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })
