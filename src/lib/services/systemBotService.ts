/**
 * System Bot Service
 *
 * Manages the per-org bot user and posts automated messages to channels.
 * The bot user has isBot=true and uses an internal email domain that
 * cannot receive real mail or authenticate via the login flow.
 *
 * All post* functions are fire-and-forget: failures are logged but never
 * thrown, so they cannot break the calling operation.
 */

import { rawPrisma, prisma, type OrgPrismaClient } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'
import { sendMessage } from '@/lib/services/messageService'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'systemBotService' })
const db = prisma as unknown as OrgPrismaClient

const BOT_EMAIL = 'bot@lionheart.internal'
const BOT_FIRST_NAME = 'Lionheart'
const BOT_LAST_NAME = 'Bot'

// ─── Bot User Management ────────────────────────────────────────────────────

/**
 * Get (or create) the system bot user for an organization.
 * Uses rawPrisma because this runs during seedOrgDefaults (outside org context).
 */
export async function getOrCreateBotUser(orgId: string): Promise<string> {
  const existing = await rawPrisma.user.findFirst({
    where: {
      organizationId: orgId,
      isBot: true,
      deletedAt: null,
    },
    select: { id: true },
  })

  if (existing) return existing.id

  const bot = await rawPrisma.user.create({
    data: {
      organizationId: orgId,
      email: BOT_EMAIL,
      firstName: BOT_FIRST_NAME,
      lastName: BOT_LAST_NAME,
      name: `${BOT_FIRST_NAME} ${BOT_LAST_NAME}`,
      isBot: true,
      status: 'ACTIVE',
    },
    select: { id: true },
  })

  return bot.id
}

// ─── Channel Posting ────────────────────────────────────────────────────────

/**
 * Post a message to a channel as the system bot. Fire-and-forget.
 */
export async function postToChannel(
  channelId: string,
  orgId: string,
  content: string,
): Promise<void> {
  try {
    const botUserId = await getOrCreateBotUser(orgId)

    // Ensure bot is a member of the channel (upsert to avoid duplicates)
    await rawPrisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId: botUserId } },
      create: { channelId, userId: botUserId, organizationId: orgId, role: 'member' },
      update: {},
    })

    await runWithOrgContext(orgId, async () => {
      await sendMessage(channelId, botUserId, { content })
    })
  } catch (error) {
    log.error(
      { err: String(error), channelId, orgId },
      'Failed to post bot message to channel',
    )
  }
}

// ─── Domain-Specific Posting Helpers ────────────────────────────────────────

/**
 * Post a ticket status change notification to the team's auto-channel.
 */
export async function postTicketStatusChange(
  ticketId: string,
  ticketTitle: string,
  oldStatus: string,
  newStatus: string,
  teamId: string | null,
  orgId: string,
): Promise<void> {
  if (!teamId) return

  try {
    const channel = await runWithOrgContext(orgId, async () => {
      return await db.channel.findFirst({
        where: { sourceType: 'team', sourceId: teamId },
        select: { id: true },
      } as Record<string, unknown>) as { id: true } | null
    }) as { id: string } | null

    if (!channel) return

    const content =
      `**Ticket Update** — _${ticketTitle}_ status changed from ${oldStatus} to ${newStatus}. ` +
      `[View ticket](/tickets/${ticketId})`

    await postToChannel(channel.id, orgId, content)
  } catch (error) {
    log.error(
      { err: String(error), ticketId, orgId },
      'Failed to post ticket status change',
    )
  }
}

/**
 * Post an event approval notification to the school's auto-channel.
 */
export async function postEventApproval(
  eventId: string,
  eventName: string,
  schoolId: string | null,
  orgId: string,
): Promise<void> {
  if (!schoolId) return

  try {
    const channel = await runWithOrgContext(orgId, async () => {
      return await db.channel.findFirst({
        where: { sourceType: 'school', sourceId: schoolId },
        select: { id: true },
      } as Record<string, unknown>) as { id: true } | null
    }) as { id: string } | null

    if (!channel) return

    const content =
      `**Event Approved** — _${eventName}_ has been approved. ` +
      `[View event](/events/${eventId})`

    await postToChannel(channel.id, orgId, content)
  } catch (error) {
    log.error(
      { err: String(error), eventId, orgId },
      'Failed to post event approval',
    )
  }
}

/**
 * Post a maintenance alert to the team's auto-channel.
 */
export async function postMaintenanceAlert(
  ticketId: string,
  ticketTitle: string,
  teamId: string | null,
  orgId: string,
): Promise<void> {
  if (!teamId) return

  try {
    const channel = await runWithOrgContext(orgId, async () => {
      return await db.channel.findFirst({
        where: { sourceType: 'team', sourceId: teamId },
        select: { id: true },
      } as Record<string, unknown>) as { id: true } | null
    }) as { id: string } | null

    if (!channel) return

    const content =
      `**Maintenance Alert** — _${ticketTitle}_ requires attention. ` +
      `[View ticket](/tickets/${ticketId})`

    await postToChannel(channel.id, orgId, content)
  } catch (error) {
    log.error(
      { err: String(error), ticketId, orgId },
      'Failed to post maintenance alert',
    )
  }
}
