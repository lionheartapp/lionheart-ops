/**
 * GET /api/messaging/channels/[id]/pins — list pinned messages in a channel (D-05)
 *
 * T-27-04: Channel membership verified before returning pinned messages.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { prisma, type OrgPrismaClient } from '@/lib/db'

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatar: true,
} as const

function shapeMessage(row: Record<string, unknown>) {
  const author = row.author as {
    id: string
    firstName?: string | null
    lastName?: string | null
    avatar?: string | null
  } | null

  return {
    id: row.id as string,
    channelId: row.channelId as string,
    authorId: author?.id ?? (row.authorId as string),
    authorName: author
      ? `${author.firstName ?? ''} ${author.lastName ?? ''}`.trim() || 'Unknown'
      : 'Unknown',
    authorAvatar: author?.avatar ?? null,
    content: row.content as string,
    pinnedAt: row.pinnedAt ? (row.pinnedAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
  }
}

export const GET = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked

  const db = prisma as unknown as OrgPrismaClient

  // T-27-04: Verify requesting user is a channel member (or auto-join public)
  const membership = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId: params.id, userId: ctx.userId } },
  })
  if (!membership) {
    // Allow public channels — return empty pins rather than blocking
    const ch = await db.channel.findUnique({ where: { id: params.id }, select: { type: true } } as Record<string, unknown>) as { type: string } | null
    if (ch?.type !== 'PUBLIC') throw new Error('Channel not found')
  }

  const messages = await db.message.findMany({
    where: {
      channelId: params.id,
      pinnedAt: { not: null },
      deletedAt: null,
    },
    orderBy: { pinnedAt: 'desc' },
    include: { author: { select: AUTHOR_SELECT } },
  })

  const shaped = messages.map((m: unknown) => shapeMessage(m as Record<string, unknown>))
  return NextResponse.json(ok(shaped))
})
