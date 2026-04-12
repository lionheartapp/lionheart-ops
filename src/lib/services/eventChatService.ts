/**
 * Event Chat Service
 *
 * CRUD for real-time chat messages scoped to an event project.
 * Messages are persisted in the DB and broadcast via Supabase Realtime.
 */

import { prisma, type OrgPrismaClient } from '@/lib/db'

export interface ChatMessageWithUser {
  id: string
  eventProjectId: string
  userId: string
  userName: string
  userAvatar: string | null
  content: string
  createdAt: string
}

/**
 * Fetch recent messages for an event project, newest last.
 * Returns the most recent 50 messages by default.
 */
export async function getMessages(
  eventProjectId: string,
  limit = 50,
): Promise<ChatMessageWithUser[]> {
  const db = prisma as unknown as OrgPrismaClient
  const rows = await db.eventChatMessage.findMany({
    where: { eventProjectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  })

  // Reverse so oldest-first for display
  return rows.reverse().map(shapeMessage)
}

/**
 * Create a new chat message and return it shaped for the client.
 */
export async function createMessage(
  eventProjectId: string,
  userId: string,
  content: string,
): Promise<ChatMessageWithUser> {
  const db = prisma as unknown as OrgPrismaClient
  const row = await db.eventChatMessage.create({
    data: {
      eventProjectId,
      userId,
      content,
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  })

  return shapeMessage(row)
}

// ─── Internal ────────────────────────────────────────────────────────────────

function shapeMessage(row: Record<string, unknown>): ChatMessageWithUser {
  const user = row.user as {
    id: string
    firstName?: string | null
    lastName?: string | null
    avatar?: string | null
  } | null

  return {
    id: row.id as string,
    eventProjectId: row.eventProjectId as string,
    userId: user?.id ?? (row.userId as string),
    userName: user
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Unknown'
      : 'Unknown',
    userAvatar: user?.avatar ?? null,
    content: row.content as string,
    createdAt: (row.createdAt as Date).toISOString(),
  }
}
