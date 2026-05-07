/**
 * Messaging Notification Service
 *
 * Creates Notification rows when users are @mentioned in a channel message
 * or receive a DM. Fire-and-forget — failures never break message sending.
 */

import { rawPrisma } from '@/lib/db'
import { createBulkNotifications } from '@/lib/services/notificationService'
import type { CreateBulkNotificationInput } from '@/lib/services/notificationService'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'messagingNotificationService' })

/**
 * Create notifications for users @mentioned in a message.
 *
 * Queries MessageMention rows for the given message, filters to user-type mentions
 * (excluding the author), checks per-channel notification preferences, and creates
 * Notification rows via createBulkNotifications.
 */
export async function notifyMentionedUsers(
  messageId: string,
  channelId: string,
  authorId: string,
  authorName: string,
): Promise<void> {
  try {
    // Get the message content and channel name
    const [message, channel] = await Promise.all([
      rawPrisma.message.findUnique({
        where: { id: messageId },
        select: { content: true },
      }),
      rawPrisma.channel.findUnique({
        where: { id: channelId },
        select: { name: true },
      }),
    ])

    if (!message || !channel) return

    // Find user mentions (exclude self-mentions)
    const mentions = await rawPrisma.messageMention.findMany({
      where: {
        messageId,
        mentionType: 'user',
        mentionedUserId: { not: null },
      },
    })

    const mentionedUserIds = mentions
      .map((m) => m.mentionedUserId)
      .filter((id): id is string => id !== null && id !== authorId)

    if (mentionedUserIds.length === 0) return

    // Check per-channel notification preferences — skip users with level = "none"
    const prefs = await rawPrisma.messagingNotificationPreference.findMany({
      where: {
        userId: { in: mentionedUserIds },
        channelId,
        level: 'none',
      },
      select: { userId: true },
    })
    const silencedSet = new Set(prefs.map((p) => p.userId))

    const eligibleUserIds = mentionedUserIds.filter((id) => !silencedSet.has(id))
    if (eligibleUserIds.length === 0) return

    const contentPreview = message.content.slice(0, 100)
    const channelName = channel.name || 'a channel'

    const notifications: CreateBulkNotificationInput[] = eligibleUserIds.map((userId) => ({
      userId,
      type: 'messaging_mention' as const,
      title: `${authorName} mentioned you in #${channelName}`,
      body: contentPreview,
      linkUrl: `/messaging?channel=${channelId}`,
    }))

    await createBulkNotifications(notifications)
  } catch (err) {
    log.error({ err, messageId, channelId }, 'Failed to notify mentioned users')
  }
}

/**
 * Create notifications for DM/group-DM recipients.
 *
 * Queries ChannelMember rows for the channel (excluding the author), checks
 * per-channel notification preferences, and creates Notification rows.
 */
export async function notifyDMRecipients(
  channelId: string,
  authorId: string,
  authorName: string,
  contentPreview: string,
): Promise<void> {
  try {
    // Get all members of this DM channel except the sender
    const members = await rawPrisma.channelMember.findMany({
      where: {
        channelId,
        userId: { not: authorId },
      },
      select: { userId: true },
    })

    const recipientIds = members.map((m) => m.userId)
    if (recipientIds.length === 0) return

    // Check per-channel notification preferences — skip users with level = "none"
    const prefs = await rawPrisma.messagingNotificationPreference.findMany({
      where: {
        userId: { in: recipientIds },
        channelId,
        level: 'none',
      },
      select: { userId: true },
    })
    const silencedSet = new Set(prefs.map((p) => p.userId))

    const eligibleIds = recipientIds.filter((id) => !silencedSet.has(id))
    if (eligibleIds.length === 0) return

    const preview = contentPreview.slice(0, 100)

    const notifications: CreateBulkNotificationInput[] = eligibleIds.map((userId) => ({
      userId,
      type: 'messaging_dm' as const,
      title: `New message from ${authorName}`,
      body: preview,
      linkUrl: `/messaging?channel=${channelId}`,
    }))

    await createBulkNotifications(notifications)
  } catch (err) {
    log.error({ err, channelId }, 'Failed to notify DM recipients')
  }
}
