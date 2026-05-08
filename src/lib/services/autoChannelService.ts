/**
 * Auto-Channel Service
 *
 * Creates and manages auto-channels that mirror team and school membership.
 * Auto-channels are PUBLIC channels with sourceType/sourceId linking them
 * back to their source entity. Membership is kept in sync by calling
 * syncTeamMembers / syncSchoolMembers from the relevant API routes.
 *
 * All functions expect to run inside runWithOrgContext so the org-scoped
 * prisma client filters by organizationId automatically.
 */

import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'
import { getOrgContextId } from '@/lib/org-context'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'autoChannelService' })

const db = prisma as unknown as OrgPrismaClient

// ─── Helpers ────────────────────────────────────────────────────────────────

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6)
}

// ─── Team Channels ──────────────────────────────────────────────────────────

/**
 * Create a PUBLIC auto-channel for a team. Idempotent: returns the existing
 * channel ID if one already exists for this team.
 */
export async function createTeamChannel(
  teamId: string,
  teamName: string,
  botUserId: string,
): Promise<string> {
  const orgId = getOrgContextId()

  // Check for existing auto-channel
  const existing = await db.channel.findFirst({
    where: { sourceType: 'team', sourceId: teamId },
    select: { id: true },
  } as Record<string, unknown>) as { id: string } | null

  if (existing) return existing.id

  let slug = toSlug(teamName)
  if (!slug) slug = `team-${randomSuffix()}`

  // Check slug collision
  const slugTaken = await db.channel.findFirst({
    where: { slug },
    select: { id: true },
  } as Record<string, unknown>)
  if (slugTaken) {
    slug = `${slug}-${randomSuffix()}`
  }

  const channel = await (db.channel as unknown as {
    create(args: Record<string, unknown>): Promise<{ id: string }>
  }).create({
    data: {
      organizationId: orgId,
      name: teamName,
      slug,
      type: 'PUBLIC',
      sourceType: 'team',
      sourceId: teamId,
      createdById: botUserId,
    },
    select: { id: true },
  })

  // Add the bot as a member
  await (db.channelMember as unknown as {
    create(args: Record<string, unknown>): Promise<unknown>
  }).create({
    data: {
      organizationId: orgId,
      channelId: channel.id,
      userId: botUserId,
      role: 'member',
    },
  })

  return channel.id
}

/**
 * Sync channel members for a team's auto-channel. Adds missing members,
 * removes stale ones. The bot user is always kept as a member.
 */
export async function syncTeamMembers(
  teamId: string,
  botUserId: string,
): Promise<void> {
  const orgId = getOrgContextId()

  // Find the auto-channel
  const channel = await db.channel.findFirst({
    where: { sourceType: 'team', sourceId: teamId },
    select: { id: true },
  } as Record<string, unknown>) as { id: string } | null

  if (!channel) return // No auto-channel yet — nothing to sync

  // Get current team members
  const teamMembers = await rawPrisma.userTeam.findMany({
    where: { teamId },
    select: { userId: true },
  })
  const desiredUserIds = new Set(teamMembers.map((m) => m.userId))
  desiredUserIds.add(botUserId) // Bot always stays

  // Get current channel members
  const channelMembers = await (db.channelMember as unknown as {
    findMany(args: Record<string, unknown>): Promise<Array<{ id: string; userId: string }>>
  }).findMany({
    where: { channelId: channel.id },
    select: { id: true, userId: true },
  })
  const existingUserIds = new Set(channelMembers.map((m) => m.userId))

  // Add missing members
  const toAdd = [...desiredUserIds].filter((uid) => !existingUserIds.has(uid))
  for (const userId of toAdd) {
    await (db.channelMember as unknown as {
      create(args: Record<string, unknown>): Promise<unknown>
    }).create({
      data: {
        organizationId: orgId,
        channelId: channel.id,
        userId,
        role: 'member',
      },
    })
  }

  // Remove stale members (but never remove the bot)
  const toRemove = channelMembers.filter(
    (m) => !desiredUserIds.has(m.userId) && m.userId !== botUserId,
  )
  for (const member of toRemove) {
    await (db.channelMember as unknown as {
      delete(args: Record<string, unknown>): Promise<unknown>
    }).delete({
      where: { id: member.id },
    })
  }
}

// ─── School Channels ────────────────────────────────────────────────────────

/**
 * Create a PUBLIC auto-channel for a school's staff. Idempotent.
 */
export async function createSchoolChannel(
  schoolId: string,
  schoolName: string,
  botUserId: string,
): Promise<string> {
  const orgId = getOrgContextId()

  const existing = await db.channel.findFirst({
    where: { sourceType: 'school', sourceId: schoolId },
    select: { id: true },
  } as Record<string, unknown>) as { id: string } | null

  if (existing) return existing.id

  const channelName = `${schoolName} Staff`
  let slug = toSlug(channelName)
  if (!slug) slug = `school-${randomSuffix()}`

  const slugTaken = await db.channel.findFirst({
    where: { slug },
    select: { id: true },
  } as Record<string, unknown>)
  if (slugTaken) {
    slug = `${slug}-${randomSuffix()}`
  }

  const channel = await (db.channel as unknown as {
    create(args: Record<string, unknown>): Promise<{ id: string }>
  }).create({
    data: {
      organizationId: orgId,
      name: channelName,
      slug,
      type: 'PUBLIC',
      sourceType: 'school',
      sourceId: schoolId,
      createdById: botUserId,
    },
    select: { id: true },
  })

  // Add the bot as a member
  await (db.channelMember as unknown as {
    create(args: Record<string, unknown>): Promise<unknown>
  }).create({
    data: {
      organizationId: orgId,
      channelId: channel.id,
      userId: botUserId,
      role: 'member',
    },
  })

  return channel.id
}

/**
 * Sync channel members for a school's auto-channel. Members are all active
 * users whose schoolId matches the school. Bot is always kept.
 */
export async function syncSchoolMembers(
  schoolId: string,
  botUserId: string,
): Promise<void> {
  const orgId = getOrgContextId()

  const channel = await db.channel.findFirst({
    where: { sourceType: 'school', sourceId: schoolId },
    select: { id: true },
  } as Record<string, unknown>) as { id: string } | null

  if (!channel) return

  // Get active users assigned to this school (org-scoped prisma filters
  // deletedAt: null automatically via the soft-delete extension)
  const schoolUsers = await db.user.findMany({
    where: { schoolId },
    select: { id: true },
  })
  const desiredUserIds = new Set(schoolUsers.map((u) => u.id))
  desiredUserIds.add(botUserId)

  const channelMembers = await (db.channelMember as unknown as {
    findMany(args: Record<string, unknown>): Promise<Array<{ id: string; userId: string }>>
  }).findMany({
    where: { channelId: channel.id },
    select: { id: true, userId: true },
  })
  const existingUserIds = new Set(channelMembers.map((m) => m.userId))

  // Add missing
  const toAdd = [...desiredUserIds].filter((uid) => !existingUserIds.has(uid))
  for (const userId of toAdd) {
    await (db.channelMember as unknown as {
      create(args: Record<string, unknown>): Promise<unknown>
    }).create({
      data: {
        organizationId: orgId,
        channelId: channel.id,
        userId,
        role: 'member',
      },
    })
  }

  // Remove stale
  const toRemove = channelMembers.filter(
    (m) => !desiredUserIds.has(m.userId) && m.userId !== botUserId,
  )
  for (const member of toRemove) {
    await (db.channelMember as unknown as {
      delete(args: Record<string, unknown>): Promise<unknown>
    }).delete({
      where: { id: member.id },
    })
  }
}

// ─── General Channel ───────────────────────────────────────────────────────

const GENERAL_SLUG = 'general'
const GENERAL_NAME = 'General'
const GENERAL_DESC = 'Company-wide announcements'

/**
 * Ensure the "General" channel exists for an org and all active users are members.
 * Called when the messaging module is first enabled. Idempotent.
 */
export async function ensureGeneralChannel(orgId: string): Promise<string> {
  try {
    const { getOrCreateBotUser } = await import('@/lib/services/systemBotService')
    const botUserId = await getOrCreateBotUser(orgId)

    // Find or create the General channel
    let channel = await rawPrisma.channel.findFirst({
      where: { organizationId: orgId, slug: GENERAL_SLUG, deletedAt: null },
      select: { id: true, name: true },
    })

    if (!channel) {
      channel = await rawPrisma.channel.create({
        data: {
          organizationId: orgId,
          name: GENERAL_NAME,
          slug: GENERAL_SLUG,
          type: 'PUBLIC',
          description: GENERAL_DESC,
          createdById: botUserId,
        },
        select: { id: true, name: true },
      })
    } else if (channel.name !== GENERAL_NAME) {
      // Fix casing if it was created as lowercase "general"
      await rawPrisma.channel.update({
        where: { id: channel.id },
        data: { name: GENERAL_NAME },
      })
    }

    // Get all active users in the org
    const activeUsers = await rawPrisma.user.findMany({
      where: { organizationId: orgId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    })

    // Get existing channel members
    const existingMembers = await rawPrisma.channelMember.findMany({
      where: { channelId: channel.id },
      select: { userId: true },
    })
    const existingIds = new Set(existingMembers.map((m) => m.userId))

    // Add missing users (including bot)
    const allUserIds = [...activeUsers.map((u) => u.id), botUserId]
    const toAdd = allUserIds.filter((id) => !existingIds.has(id))

    if (toAdd.length > 0) {
      await rawPrisma.channelMember.createMany({
        data: toAdd.map((userId) => ({
          organizationId: orgId,
          channelId: channel!.id,
          userId,
          role: 'member',
        })),
        skipDuplicates: true,
      })
    }

    return channel.id
  } catch (error) {
    log.error({ err: String(error), orgId }, 'Failed to ensure General channel')
    throw error
  }
}

/**
 * Add a single user to the General channel. Called when a new user is created.
 * Non-fatal: errors are logged but never thrown.
 */
export async function addUserToGeneralChannel(userId: string, orgId: string): Promise<void> {
  try {
    const channel = await rawPrisma.channel.findFirst({
      where: { organizationId: orgId, slug: GENERAL_SLUG, deletedAt: null },
      select: { id: true },
    })
    if (!channel) return // General channel doesn't exist yet — will be added on next sync

    await rawPrisma.channelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId } },
      create: { organizationId: orgId, channelId: channel.id, userId, role: 'member' },
      update: {},
    })
  } catch (error) {
    log.error({ err: String(error), userId, orgId }, 'Failed to add user to General channel')
  }
}
