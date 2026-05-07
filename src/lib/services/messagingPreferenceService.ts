/**
 * Messaging Notification Preference Service
 *
 * Shared query logic for per-channel notification preferences.
 * Uses rawPrisma because these functions may be called from contexts
 * outside runWithOrgContext (e.g., cron jobs, notification service).
 */

import { rawPrisma } from '@/lib/db'

interface ChannelPreference {
  level: string
  emailDigest: boolean
}

const DEFAULT_PREFERENCE: ChannelPreference = {
  level: 'all',
  emailDigest: true,
}

/**
 * Get a user's notification preference for a specific channel.
 * Returns sensible defaults if no preference row exists.
 */
export async function getChannelPreference(
  userId: string,
  channelId: string
): Promise<ChannelPreference> {
  const pref = await rawPrisma.messagingNotificationPreference.findUnique({
    where: { userId_channelId: { userId, channelId } },
    select: { level: true, emailDigest: true },
  })

  return pref ?? DEFAULT_PREFERENCE
}

/**
 * Determine whether a user should receive a notification for a channel message.
 *
 * Logic:
 * - level "none"     -> never notify
 * - level "mentions" -> only notify if the user was @mentioned
 * - level "all"      -> always notify
 */
export async function shouldNotify(
  userId: string,
  channelId: string,
  isMention: boolean
): Promise<boolean> {
  const { level } = await getChannelPreference(userId, channelId)

  if (level === 'none') return false
  if (level === 'mentions') return isMention
  return true // "all"
}

/**
 * Check whether a user has email digest enabled on any channel.
 * Used by the digest cron to decide whether to include this user.
 */
export async function getUserDigestPreference(
  userId: string
): Promise<{ enabled: boolean }> {
  const count = await rawPrisma.messagingNotificationPreference.count({
    where: { userId, emailDigest: true },
  })

  // If user has at least one channel with digest on, or has no preferences
  // at all (defaults to enabled), digest is enabled.
  if (count > 0) return { enabled: true }

  // Check if user has ANY preference rows. If none, they're on defaults
  // (which means digest is enabled).
  const total = await rawPrisma.messagingNotificationPreference.count({
    where: { userId },
  })

  return { enabled: total === 0 }
}
