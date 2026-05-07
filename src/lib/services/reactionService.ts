/**
 * Reaction Service
 *
 * Toggle emoji reactions on messages and batch-load reaction groups
 * for display in the message list.
 */

import { z } from 'zod'
import { prisma, type OrgPrismaClient } from '@/lib/db'

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const ToggleReactionSchema = z.object({
  emoji: z.string().min(1).max(32),
})

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ReactionGroup {
  emoji: string
  count: number
  userIds: string[]
}

interface ReactionRow {
  id: string
  messageId: string
  userId: string
  emoji: string
  createdAt: Date
}

// ─── Toggle Reaction ────────────────────────────────────────────────────────

/**
 * Toggle a reaction on a message. If the user already reacted with this emoji,
 * remove it. Otherwise, add it.
 *
 * T-27-01: Validates emoji via Zod. Verifies channel membership before creating.
 * T-27-03: userId comes from JWT (ctx.userId), never from client body.
 */
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<{ action: 'added' | 'removed'; emoji: string }> {
  const db = prisma as unknown as OrgPrismaClient

  // Verify message exists and get its channelId
  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { id: true, channelId: true },
  })
  if (!message) throw new Error('Message not found')

  const channelId = (message as Record<string, unknown>).channelId as string

  // T-27-01: Verify user is a member of the message's channel
  const membership = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  })
  if (!membership) throw new Error('Not a member of this channel')

  // Check if reaction already exists
  const existing = await db.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
  })

  if (existing) {
    // Remove the reaction
    await db.messageReaction.delete({
      where: { id: (existing as Record<string, unknown>).id as string },
    })
    return { action: 'removed', emoji }
  }

  // Add the reaction
  await db.messageReaction.create({
    data: { messageId, userId, emoji },
  })

  return { action: 'added', emoji }
}

// ─── Batch-Load Reactions ───────────────────────────────────────────────────

/**
 * Batch-load all reactions for an array of message IDs.
 * Returns a map of messageId -> ReactionGroup[].
 */
export async function getReactionsForMessages(
  messageIds: string[],
): Promise<Record<string, ReactionGroup[]>> {
  if (messageIds.length === 0) return {}

  const db = prisma as unknown as OrgPrismaClient

  const reactions = await db.messageReaction.findMany({
    where: { messageId: { in: messageIds } },
    select: { messageId: true, userId: true, emoji: true },
  }) as unknown as Array<{ messageId: string; userId: string; emoji: string }>

  // Group by messageId, then by emoji
  const result: Record<string, ReactionGroup[]> = {}

  for (const reaction of reactions) {
    if (!result[reaction.messageId]) {
      result[reaction.messageId] = []
    }

    const groups = result[reaction.messageId]
    let group = groups.find((g) => g.emoji === reaction.emoji)
    if (!group) {
      group = { emoji: reaction.emoji, count: 0, userIds: [] }
      groups.push(group)
    }
    group.count += 1
    group.userIds.push(reaction.userId)
  }

  return result
}
