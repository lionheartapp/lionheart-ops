/**
 * GET/PUT /api/messaging/channels/[id]/preferences
 *
 * Per-channel notification preferences for the current user (D-13).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const PreferenceSchema = z.object({
  level: z.enum(['all', 'mentions', 'none']),
  emailDigest: z.boolean(),
})

// GET — return the user's preference for this channel (or defaults)
export const GET = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked

  const channelId = params.id

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { userId: ctx.userId, channelId } },
    select: { userId: true },
  })
  if (!membership) {
    return NextResponse.json(fail('NOT_FOUND', 'Channel not found'), { status: 404 })
  }

  const pref = await prisma.messagingNotificationPreference.findUnique({
    where: { userId_channelId: { userId: ctx.userId, channelId } },
    select: { level: true, emailDigest: true },
  })

  return NextResponse.json(ok(pref ?? { level: 'all', emailDigest: true }))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })

// PUT — upsert the user's preference for this channel
export const PUT = withAuth<z.infer<typeof PreferenceSchema>, { id: string }>(
  async ({ ctx, orgId, params, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked

    const channelId = params.id
    const { level, emailDigest } = body

    const membership = await prisma.channelMember.findUnique({
      where: { channelId_userId: { userId: ctx.userId, channelId } },
      select: { userId: true },
    })
    if (!membership) {
      return NextResponse.json(fail('NOT_FOUND', 'Channel not found'), { status: 404 })
    }

    const result = await prisma.messagingNotificationPreference.upsert({
      where: { userId_channelId: { userId: ctx.userId, channelId } },
      create: {
        userId: ctx.userId,
        channelId,
        level,
        emailDigest,
      } as any,
      update: {
        level,
        emailDigest,
      },
    })

    return NextResponse.json(ok(result))
  },
  { permission: PERMISSIONS.MESSAGING_ACCESS, schema: PreferenceSchema },
)
