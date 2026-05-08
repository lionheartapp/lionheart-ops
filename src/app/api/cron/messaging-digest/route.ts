/**
 * GET /api/cron/messaging-digest — daily messaging digest cron job (NOTIF-04)
 *
 * Secured by CRON_SECRET in the Authorization header (T-28-09).
 * Runs across all messaging-enabled organizations, finds users with unread
 * messages who have email digests enabled, and sends a summary email per user.
 *
 * Schedule: configured in vercel.json (e.g., daily at 8am UTC).
 * Users opt in/out via the emailDigest toggle on MessagingNotificationPreference.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { sendMessagingDigest } from '@/lib/services/email/messaging-emails'
import { logger } from '@/lib/logger'

const log = logger.child({ cron: 'messaging-digest' })

export async function GET(req: NextRequest) {
  // ─── Auth (T-28-09) ────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret) {
    log.error('CRON_SECRET not configured')
    return NextResponse.json(
      fail('CONFIGURATION_ERROR', 'Cron secret not configured'),
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      fail('UNAUTHORIZED', 'Invalid or missing cron secret'),
      { status: 401 }
    )
  }

  try {
    // ─── Find messaging-enabled orgs ───────────────────────────────
    const orgs = await rawPrisma.organization.findMany({
      where: { messagingEnabled: true },
      select: { id: true, slug: true },
    })

    if (orgs.length === 0) {
      log.info('No messaging-enabled orgs — nothing to do')
      return NextResponse.json(ok({ sent: 0, orgs: 0 }))
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      'https://app.lionheartapp.com'

    let totalSent = 0
    let orgsProcessed = 0

    for (const org of orgs) {
      // Find channel members with unread messages in this org
      const membersWithUnreads = await rawPrisma.channelMember.findMany({
        where: {
          unreadCount: { gt: 0 },
          channel: { organizationId: org.id },
        },
        select: {
          userId: true,
          channelId: true,
          unreadCount: true,
          lastReadAt: true,
          channel: { select: { id: true, name: true } },
        },
      })

      if (membersWithUnreads.length === 0) continue

      // Group by user
      const userChannelMap = new Map<
        string,
        Array<{
          channelId: string
          channelName: string
          unreadCount: number
          lastReadAt: Date | null
        }>
      >()

      for (const m of membersWithUnreads) {
        const existing = userChannelMap.get(m.userId) || []
        existing.push({
          channelId: m.channelId,
          channelName: m.channel.name || 'Unnamed',
          unreadCount: m.unreadCount,
          lastReadAt: m.lastReadAt,
        })
        userChannelMap.set(m.userId, existing)
      }

      // Process each user
      for (const [userId, channels] of userChannelMap) {
        // Check if user has email digest enabled.
        // Default is true (emailDigest defaults to true in schema), so we only
        // skip if there's an explicit preference with emailDigest = false.
        const disabledPrefs = await rawPrisma.messagingNotificationPreference.findMany({
          where: {
            userId,
            emailDigest: false,
            OR: [
              { channelId: null },     // global preference
              { channelId: { in: channels.map((c) => c.channelId) } },
            ],
          },
          select: { channelId: true },
        })

        // If global digest is disabled (channelId = null), skip this user entirely
        const globalDisabled = disabledPrefs.some((p) => p.channelId === null)
        if (globalDisabled) continue

        // Filter out channels where digest is explicitly disabled
        const disabledChannelIds = new Set(
          disabledPrefs.map((p) => p.channelId).filter(Boolean)
        )
        const eligibleChannels = channels.filter(
          (c) => !disabledChannelIds.has(c.channelId)
        )
        if (eligibleChannels.length === 0) continue

        // Fetch user info
        const user = await rawPrisma.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true, lastName: true, deletedAt: true },
        })
        if (!user || !user.email || user.deletedAt) continue

        // Fetch message previews for each channel
        const channelDigests = await Promise.all(
          eligibleChannels.map(async (ch) => {
            const recentMessages = await rawPrisma.message.findMany({
              where: {
                channelId: ch.channelId,
                ...(ch.lastReadAt ? { createdAt: { gt: ch.lastReadAt } } : {}),
              },
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: {
                content: true,
                createdAt: true,
                author: { select: { firstName: true, lastName: true } },
              },
            })

            return {
              name: ch.channelName,
              unreadCount: ch.unreadCount,
              previews: recentMessages.map((msg) => ({
                author: [(msg as any).author?.firstName, (msg as any).author?.lastName]
                  .filter(Boolean)
                  .join(' ') || 'Unknown',
                text: msg.content,
                time: formatRelativeTime(msg.createdAt),
              })),
            }
          })
        )

        const userName =
          [user.firstName, user.lastName].filter(Boolean).join(' ') || 'there'

        await sendMessagingDigest({
          to: user.email,
          userName,
          channels: channelDigests,
          appUrl,
        })

        totalSent++
      }

      orgsProcessed++
    }

    log.info({ sent: totalSent, orgs: orgsProcessed }, 'Messaging digest complete')
    return NextResponse.json(ok({ sent: totalSent, orgs: orgsProcessed }))
  } catch (err) {
    log.error({ err }, 'Messaging digest cron failed')
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Digest cron failed'),
      { status: 500 }
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
