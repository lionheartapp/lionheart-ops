/**
 * Channel Service
 *
 * CRUD for messaging channels, DM find-or-create, and member management.
 * All functions run inside runWithOrgContext (via withAuth) so org-scoped
 * Prisma automatically filters by organizationId.
 */

import { z } from 'zod'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const CreateChannelSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  type: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  description: z.string().max(500).trim().optional().nullable(),
})

export const UpdateChannelSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(500).trim().optional().nullable(),
  topic: z.string().max(500).trim().optional().nullable(),
})

export const AddMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['admin', 'member']).default('member'),
})

export const RemoveMemberSchema = z.object({
  userId: z.string().min(1),
})

export const FindOrCreateDMSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(7),
})

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserSelect {
  id: string
  firstName: string | null
  lastName: string | null
  avatar: string | null
  email?: string | null
}

interface MemberRow {
  id: string
  channelId: string
  userId: string
  role: string
  unreadCount: number
  lastReadAt: Date | null
  mutedAt: Date | null
  createdAt: Date
  user: UserSelect
}

interface ChannelRow {
  id: string
  name: string
  slug: string
  type: string
  description: string | null
  topic: string | null
  sourceType: string | null
  sourceId: string | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdById: string
  members?: MemberRow[]
  _count?: { members: number }
  messages?: Array<{
    id: string
    content: string
    authorId: string
    createdAt: Date
  }>
}

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

function shapeChannel(row: ChannelRow) {
  const lastMessage = row.messages?.[0] ?? null
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    description: row.description,
    topic: row.topic,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdById: row.createdById,
    sourceType: row.sourceType ?? null,
    sourceId: row.sourceId ?? null,
    memberCount: row._count?.members ?? row.members?.length ?? 0,
    members: row.members?.map(shapeMember),
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          content: lastMessage.content,
          authorId: lastMessage.authorId,
          createdAt: lastMessage.createdAt.toISOString(),
        }
      : null,
  }
}

function shapeMember(row: MemberRow) {
  return {
    id: row.id,
    channelId: row.channelId,
    userId: row.userId,
    role: row.role,
    unreadCount: row.unreadCount,
    lastReadAt: row.lastReadAt?.toISOString() ?? null,
    mutedAt: row.mutedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    user: {
      id: row.user.id,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      avatar: row.user.avatar,
      email: row.user.email ?? null,
    },
  }
}

const db = prisma as unknown as OrgPrismaClient

// ─── Channel CRUD ───────────────────────────────────────────────────────────

/**
 * Create a channel and auto-add the creator as owner (D-04).
 */
export async function createChannel(
  input: z.infer<typeof CreateChannelSchema>,
  userId: string,
) {
  let slug = toSlug(input.name)
  if (!slug) slug = `channel-${randomSuffix()}`

  // Check for slug collision within org; append suffix if needed
  const existing = await db.channel.findFirst({
    where: { slug },
    select: { id: true },
  })
  if (existing) {
    slug = `${slug}-${randomSuffix()}`
  }

  const channel = await db.channel.create({
    data: {
      name: input.name,
      slug,
      type: input.type ?? 'PUBLIC',
      description: input.description ?? null,
      createdById: userId,
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      },
      _count: { select: { members: true } },
    },
  } as Record<string, unknown>)

  // Auto-add creator as owner
  await db.channelMember.create({
    data: {
      channelId: channel.id,
      userId,
      role: 'owner',
    },
  })

  // Re-fetch to include the new member
  const result = await db.channel.findUnique({
    where: { id: channel.id },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      },
      _count: { select: { members: true } },
    },
  } as Record<string, unknown>)

  return shapeChannel(result as unknown as ChannelRow)
}

/**
 * Get all channels visible to the user:
 * - All PUBLIC channels (not archived)
 * - PRIVATE channels where user is a member
 * - DM/GROUP_DM channels where user is a member
 *
 * T-24-01: PRIVATE/DM channels filtered to membership only.
 */
export async function getChannels(userId: string) {
  const channels = await db.channel.findMany({
    where: {
      archivedAt: null,
      OR: [
        { type: 'PUBLIC' },
        {
          type: { in: ['PRIVATE', 'DM', 'GROUP_DM'] },
          members: { some: { userId } },
        },
      ],
    },
    include: {
      _count: { select: { members: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, content: true, authorId: true, createdAt: true },
      },
      members: {
        where: { userId },
        select: { unreadCount: true, lastReadAt: true, mutedAt: true },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  } as Record<string, unknown>) as unknown as ChannelRow[]

  return channels.map(shapeChannel)
}

/**
 * Get a single channel with members.
 * T-24-03: For PRIVATE/DM/GROUP_DM, verify membership; throw 'not found' to avoid leaking existence.
 */
export async function getChannel(channelId: string, userId: string) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
        },
      },
      _count: { select: { members: true } },
    },
  } as Record<string, unknown>) as unknown as ChannelRow | null

  if (!channel) {
    throw new Error('Channel not found')
  }

  // For non-public channels, verify membership
  if (channel.type !== 'PUBLIC') {
    const isMember = channel.members?.some((m) => m.userId === userId)
    if (!isMember) {
      throw new Error('Channel not found')
    }
  }

  return shapeChannel(channel)
}

/**
 * Update a channel. Caller must be owner/admin or have MESSAGING_CHANNELS_MANAGE.
 * T-24-02: Permission check before allowing update.
 */
export async function updateChannel(
  channelId: string,
  userId: string,
  input: z.infer<typeof UpdateChannelSchema>,
) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    include: {
      members: { where: { userId }, select: { role: true }, take: 1 },
    },
  } as Record<string, unknown>) as unknown as { id: string; name: string; members: Array<{ role: string }> } | null

  if (!channel) {
    throw new Error('Channel not found')
  }

  const memberRole = channel.members[0]?.role
  const hasManagePerm = await can(userId, PERMISSIONS.MESSAGING_CHANNELS_MANAGE)
  if (!hasManagePerm && memberRole !== 'owner' && memberRole !== 'admin') {
    throw new Error('Insufficient permissions')
  }

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) {
    data.name = input.name
    data.slug = toSlug(input.name) || `channel-${randomSuffix()}`
    // Check slug collision
    const slugExists = await db.channel.findFirst({
      where: { slug: data.slug as string, id: { not: channelId } },
      select: { id: true },
    })
    if (slugExists) {
      data.slug = `${data.slug}-${randomSuffix()}`
    }
  }
  if (input.description !== undefined) data.description = input.description
  if (input.topic !== undefined) data.topic = input.topic

  const updated = await db.channel.update({
    where: { id: channelId },
    data,
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      },
      _count: { select: { members: true } },
    },
  } as Record<string, unknown>)

  return shapeChannel(updated as unknown as ChannelRow)
}

/**
 * Archive a channel. DM/GROUP_DM channels cannot be archived.
 */
export async function archiveChannel(channelId: string, userId: string) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    include: {
      members: { where: { userId }, select: { role: true }, take: 1 },
    },
  } as Record<string, unknown>) as unknown as { id: string; type: string; members: Array<{ role: string }> } | null

  if (!channel) {
    throw new Error('Channel not found')
  }

  if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
    throw new Error('DM channels cannot be archived')
  }

  const memberRole = channel.members[0]?.role
  const hasManagePerm = await can(userId, PERMISSIONS.MESSAGING_CHANNELS_MANAGE)
  if (!hasManagePerm && memberRole !== 'owner') {
    throw new Error('Insufficient permissions')
  }

  await db.channel.update({
    where: { id: channelId },
    data: { archivedAt: new Date() },
  })

  return { archived: true }
}

// ─── Member Management ──────────────────────────────────────────────────────

/**
 * Get all members of a channel, ordered by role rank then join date.
 */
export async function getChannelMembers(channelId: string) {
  const members = await db.channelMember.findMany({
    where: { channelId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
    },
  } as Record<string, unknown>) as unknown as MemberRow[]

  // Sort: owner first, then admin, then member
  const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2 }
  const sorted = [...members].sort((a, b) => {
    const ra = roleOrder[a.role] ?? 3
    const rb = roleOrder[b.role] ?? 3
    if (ra !== rb) return ra - rb
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

  return sorted.map(shapeMember)
}

/**
 * Add a member to a channel.
 * T-24-04: Only owner/admin or users with MESSAGING_CHANNELS_MANAGE can add members.
 * Cannot add to DM channels.
 */
export async function addMember(
  channelId: string,
  input: z.infer<typeof AddMemberSchema>,
  actingUserId: string,
) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    include: {
      members: { where: { userId: actingUserId }, select: { role: true }, take: 1 },
    },
  } as Record<string, unknown>) as unknown as { id: string; type: string; members: Array<{ role: string }> } | null

  if (!channel) {
    throw new Error('Channel not found')
  }

  if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
    throw new Error('Cannot add members to DM channels')
  }

  const actingRole = channel.members[0]?.role
  const hasManagePerm = await can(actingUserId, PERMISSIONS.MESSAGING_CHANNELS_MANAGE)
  if (!hasManagePerm && actingRole !== 'owner' && actingRole !== 'admin') {
    throw new Error('Insufficient permissions')
  }

  const member = await db.channelMember.upsert({
    where: { channelId_userId: { channelId, userId: input.userId } },
    create: { channelId, userId: input.userId, role: input.role ?? 'member' },
    update: {},
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
    },
  } as Record<string, unknown>) as unknown as MemberRow

  return shapeMember(member)
}

/**
 * Remove a member from a channel (hard delete on ChannelMember).
 * Cannot remove from DM channels. Cannot remove self if sole owner.
 */
export async function removeMember(
  channelId: string,
  userId: string,
  actingUserId: string,
) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    include: {
      members: {
        select: { userId: true, role: true },
      },
    },
  } as Record<string, unknown>) as unknown as {
    id: string
    type: string
    members: Array<{ userId: string; role: string }>
  } | null

  if (!channel) {
    throw new Error('Channel not found')
  }

  if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
    throw new Error('Cannot remove members from DM channels')
  }

  // Check acting user permission
  const actingMember = channel.members.find((m) => m.userId === actingUserId)
  const hasManagePerm = await can(actingUserId, PERMISSIONS.MESSAGING_CHANNELS_MANAGE)
  if (!hasManagePerm && actingMember?.role !== 'owner' && actingMember?.role !== 'admin') {
    throw new Error('Insufficient permissions')
  }

  // Cannot remove self if sole owner
  const targetMember = channel.members.find((m) => m.userId === userId)
  if (!targetMember) {
    throw new Error('User is not a member of this channel')
  }
  if (targetMember.role === 'owner' && userId === actingUserId) {
    const ownerCount = channel.members.filter((m) => m.role === 'owner').length
    if (ownerCount <= 1) {
      throw new Error('Cannot remove the sole owner of a channel')
    }
  }

  // Hard delete (ChannelMember uses hard delete per Phase 23 decision)
  await db.channelMember.delete({
    where: { channelId_userId: { channelId, userId } },
  })

  return { removed: true }
}

// ─── DM Find-or-Create ─────────────────────────────────────────────────────

/**
 * Find or create a DM/GROUP_DM channel between the caller and target users.
 * D-05: Idempotent — same userIds always returns same channel.
 * D-06: Max 8 total (caller + 7 targets).
 * T-24-05: Array length validated in Zod schema (max 7).
 */
export async function findOrCreateDM(
  callerUserId: string,
  targetUserIds: string[],
) {
  // Combine, deduplicate, sort
  const uniqueSet = new Set([callerUserId, ...targetUserIds])
  const allUserIds = Array.from(uniqueSet).sort()

  if (allUserIds.length > 8) {
    throw new Error('Group DMs are limited to 8 members')
  }

  const channelType = allUserIds.length === 2 ? 'DM' : 'GROUP_DM'

  // Find existing channel with EXACTLY these members.
  // Query channels where the caller is a member, filter by type,
  // then check exact membership match.
  const callerChannels = await db.channelMember.findMany({
    where: { userId: callerUserId },
    select: { channelId: true },
  } as Record<string, unknown>) as unknown as Array<{ channelId: string }>

  const channelIds = callerChannels.map((cm) => cm.channelId)

  if (channelIds.length > 0) {
    const candidates = await db.channel.findMany({
      where: {
        id: { in: channelIds },
        type: channelType,
      },
      include: {
        members: { select: { userId: true } },
        _count: { select: { members: true } },
      },
    } as Record<string, unknown>) as unknown as Array<{
      id: string
      members: Array<{ userId: string }>
      _count: { members: number }
    }>

    for (const ch of candidates) {
      if (ch._count.members !== allUserIds.length) continue
      const memberIds = ch.members.map((m) => m.userId).sort()
      if (
        memberIds.length === allUserIds.length &&
        memberIds.every((id, i) => id === allUserIds[i])
      ) {
        // Found existing channel — return it
        const full = await db.channel.findUnique({
          where: { id: ch.id },
          include: {
            members: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
              },
            },
            _count: { select: { members: true } },
          },
        } as Record<string, unknown>)
        return shapeChannel(full as unknown as ChannelRow)
      }
    }
  }

  // No existing channel found — create one
  const dmName =
    channelType === 'DM' ? 'Direct Message' : `Group DM (${allUserIds.length})`
  const slug = `dm-${randomSuffix()}-${randomSuffix()}`

  const channel = await db.channel.create({
    data: {
      name: dmName,
      slug,
      type: channelType,
      createdById: callerUserId,
    },
  })

  // Add all participants as members; caller is owner, rest are members
  for (const uid of allUserIds) {
    await db.channelMember.create({
      data: {
        channelId: channel.id,
        userId: uid,
        role: uid === callerUserId ? 'owner' : 'member',
      },
    })
  }

  // Return the full channel
  const result = await db.channel.findUnique({
    where: { id: channel.id },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      },
      _count: { select: { members: true } },
    },
  } as Record<string, unknown>)

  return shapeChannel(result as unknown as ChannelRow)
}
