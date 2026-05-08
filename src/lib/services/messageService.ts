/**
 * Message Service
 *
 * Business logic for message CRUD, @mention parsing, cursor-based pagination,
 * and full-text search using tsvector GIN indexes.
 */

import { z } from 'zod'
import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'
import { getOrgContextId } from '@/lib/org-context'
import { Prisma } from '@prisma/client'
import type { AttachmentData } from '@/lib/services/attachmentService'
import { notifyMentionedUsers, notifyDMRecipients } from '@/lib/services/messagingNotificationService'

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(4000).trim(),
  parentId: z.string().optional(),
  attachments: z.array(z.object({
    fileName: z.string(),
    fileSize: z.number(),
    mimeType: z.string(),
    storageUrl: z.string(),
  })).optional(),
})

export const EditMessageSchema = z.object({
  content: z.string().min(1).max(4000).trim(),
})

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  channelId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
})

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MessageWithAuthor {
  id: string
  channelId: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  authorIsBot: boolean
  content: string
  parentId: string | null
  replyCount: number
  editedAt: string | null
  pinnedAt: string | null
  createdAt: string
  attachments?: AttachmentData[]
}

export interface SearchResult {
  id: string
  channelId: string
  channelName: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  content: string
  createdAt: string
}

// ─── Shape Helper ───────────────────────────────────────────────────────────

function shapeMessage(row: Record<string, unknown>): MessageWithAuthor {
  const author = row.author as {
    id: string
    firstName?: string | null
    lastName?: string | null
    avatar?: string | null
    isBot?: boolean
  } | null

  // Shape attachments if present in the include
  const rawAttachments = row.attachments as Array<Record<string, unknown>> | undefined
  const attachments: AttachmentData[] | undefined = rawAttachments?.map((a) => ({
    id: a.id as string,
    fileName: a.fileName as string,
    fileSize: a.fileSize as number,
    mimeType: a.mimeType as string,
    storageUrl: a.storageUrl as string,
  }))

  return {
    id: row.id as string,
    channelId: row.channelId as string,
    authorId: author?.id ?? (row.authorId as string),
    authorName: author
      ? `${author.firstName ?? ''} ${author.lastName ?? ''}`.trim() || 'Unknown'
      : 'Unknown',
    authorAvatar: author?.avatar ?? null,
    authorIsBot: author?.isBot ?? false,
    content: row.content as string,
    parentId: (row.parentId as string | null) ?? null,
    replyCount: (row.replyCount as number) ?? 0,
    editedAt: row.editedAt ? (row.editedAt as Date).toISOString() : null,
    pinnedAt: row.pinnedAt ? (row.pinnedAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  }
}

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatar: true,
  isBot: true,
} as const

// ─── Notification Helper ────────────────────────────────────────────────────

/**
 * Fire-and-forget: look up channel type and author name, then dispatch
 * the appropriate notification (DM vs mention). Failures are swallowed
 * so they never break message sending.
 */
function fireMessageNotifications(
  channelId: string,
  messageId: string,
  userId: string,
  content: string,
  db: OrgPrismaClient,
): void {
  ;(async () => {
    const [channel, author] = await Promise.all([
      db.channel.findUnique({ where: { id: channelId }, select: { name: true, type: true } }),
      db.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } }),
    ])
    const authorName = [author?.firstName, author?.lastName].filter(Boolean).join(' ') || 'Someone'

    if (channel?.type === 'DM' || channel?.type === 'GROUP_DM') {
      await notifyDMRecipients(channelId, userId, authorName, content.slice(0, 100))
    } else {
      await notifyMentionedUsers(messageId, channelId, userId, authorName)
    }
  })().catch(() => {})
}

// ─── Send Message ───────────────────────────────────────────────────────────

export async function sendMessage(
  channelId: string,
  userId: string,
  input: z.infer<typeof SendMessageSchema>,
): Promise<MessageWithAuthor> {
  const db = prisma as unknown as OrgPrismaClient

  // T-24-07: Verify user is a member of this channel
  const membership = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  })
  if (!membership) throw new Error('Not a member of this channel')

  // T-24-12: If replying to a thread, verify parent exists in same channel
  if (input.parentId) {
    const parent = await db.message.findFirst({
      where: { id: input.parentId, channelId },
    })
    if (!parent) throw new Error('Parent message not found')
  }

  const row = await db.message.create({
    data: {
      channelId,
      authorId: userId,
      content: input.content,
      parentId: input.parentId ?? null,
    },
    include: { author: { select: AUTHOR_SELECT }, attachments: true },
  })

  // Create attachment records if any
  if (input.attachments && input.attachments.length > 0) {
    const orgId = getOrgContextId()
    for (const att of input.attachments) {
      await db.messageAttachment.create({
        data: {
          messageId: row.id as string,
          organizationId: orgId,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          storageUrl: att.storageUrl,
        },
      })
    }
    // Re-fetch to include newly created attachments
    const updated = await db.message.findUnique({
      where: { id: row.id as string },
      include: { author: { select: AUTHOR_SELECT }, attachments: true },
    })
    if (updated) {
      // Increment parent's reply count for thread replies
      if (input.parentId) {
        await db.message.update({
          where: { id: input.parentId },
          data: { replyCount: { increment: 1 } },
        })
      }
      await parseMentions(input.content, row.id as string)
      // Fire-and-forget notification creation (D-05)
      fireMessageNotifications(channelId, row.id as string, userId, input.content, db)
      return shapeMessage(updated as unknown as Record<string, unknown>)
    }
  }

  // Increment parent's reply count for thread replies
  if (input.parentId) {
    await db.message.update({
      where: { id: input.parentId },
      data: { replyCount: { increment: 1 } },
    })
  }

  // Parse @mentions and create MessageMention rows
  await parseMentions(input.content, row.id as string)

  // Fire-and-forget notification creation (D-05)
  fireMessageNotifications(channelId, row.id as string, userId, input.content, db)

  return shapeMessage(row as unknown as Record<string, unknown>)
}

// ─── Edit Message ───────────────────────────────────────────────────────────

export async function editMessage(
  messageId: string,
  userId: string,
  input: z.infer<typeof EditMessageSchema>,
): Promise<MessageWithAuthor> {
  const db = prisma as unknown as OrgPrismaClient

  // T-24-10: Only the author can edit their own message
  const existing = await db.message.findUnique({
    where: { id: messageId },
  })
  if (!existing) throw new Error('Message not found')
  if ((existing as Record<string, unknown>).authorId !== userId) {
    throw new Error('You can only edit your own messages')
  }

  const row = await db.message.update({
    where: { id: messageId },
    data: { content: input.content, editedAt: new Date() },
    include: { author: { select: AUTHOR_SELECT } },
  })

  // Re-parse mentions: delete old ones and create new ones
  await db.messageMention.deleteMany({ where: { messageId } })
  await parseMentions(input.content, messageId)

  return shapeMessage(row as unknown as Record<string, unknown>)
}

// ─── Delete Message ─────────────────────────────────────────────────────────

export async function deleteMessage(
  messageId: string,
  userId: string,
  canDeleteAny: boolean,
): Promise<{ deleted: true }> {
  const db = prisma as unknown as OrgPrismaClient

  const existing = await db.message.findUnique({
    where: { id: messageId },
  })
  if (!existing) throw new Error('Message not found')

  const authorId = (existing as Record<string, unknown>).authorId as string

  // T-24-11: Author can always delete own messages. Others require canDeleteAny.
  if (authorId !== userId && !canDeleteAny) {
    throw new Error('You can only delete your own messages')
  }

  // Soft-delete via update (the Prisma extension handles deletedAt on .delete(),
  // but explicit update is clearer for the soft-delete intent)
  await db.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  })

  // Decrement parent's reply count if this was a thread reply
  const parentId = (existing as Record<string, unknown>).parentId as string | null
  if (parentId) {
    await db.message.update({
      where: { id: parentId },
      data: { replyCount: { decrement: 1 } },
    })
  }

  return { deleted: true }
}

// ─── Parse Mentions ─────────────────────────────────────────────────────────

export async function parseMentions(
  content: string,
  messageId: string,
): Promise<void> {
  const db = prisma as unknown as OrgPrismaClient

  // Delete existing mentions for idempotent re-parse on edit
  await db.messageMention.deleteMany({ where: { messageId } })

  interface MentionRow {
    messageId: string
    mentionedUserId: string | null
    mentionType: string
    teamId: string | null
  }

  const mentions: MentionRow[] = []

  // Match @user:userId or <@userId> patterns
  const userPattern1 = /@user:([a-zA-Z0-9_-]+)/g
  const userPattern2 = /<@([a-zA-Z0-9_-]+)>/g
  let match: RegExpExecArray | null

  match = userPattern1.exec(content)
  while (match !== null) {
    mentions.push({
      messageId,
      mentionedUserId: match[1],
      mentionType: 'user',
      teamId: null,
    })
    match = userPattern1.exec(content)
  }

  match = userPattern2.exec(content)
  while (match !== null) {
    mentions.push({
      messageId,
      mentionedUserId: match[1],
      mentionType: 'user',
      teamId: null,
    })
    match = userPattern2.exec(content)
  }

  // Match @channel
  if (/@channel\b/.test(content)) {
    mentions.push({
      messageId,
      mentionedUserId: null,
      mentionType: 'channel',
      teamId: null,
    })
  }

  // Match @here
  if (/@here\b/.test(content)) {
    mentions.push({
      messageId,
      mentionedUserId: null,
      mentionType: 'here',
      teamId: null,
    })
  }

  // Match @team:teamId
  const teamPattern = /@team:([a-zA-Z0-9_-]+)/g
  match = teamPattern.exec(content)
  while (match !== null) {
    mentions.push({
      messageId,
      mentionedUserId: null,
      mentionType: 'team',
      teamId: match[1],
    })
    match = teamPattern.exec(content)
  }

  if (mentions.length > 0) {
    await db.messageMention.createMany({
      data: mentions,
    })
  }
}

// ─── Get Messages (cursor-based pagination) ─────────────────────────────────

export async function getMessages(
  channelId: string,
  userId: string,
  opts: { before?: string; after?: string; limit: number; parentId?: string },
): Promise<{ messages: MessageWithAuthor[]; hasMore: boolean; cursor: string | null }> {
  const db = prisma as unknown as OrgPrismaClient

  // T-24-07: Verify user is a member of this channel
  const membership = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  })
  if (!membership) throw new Error('Not a member of this channel')

  // Build cursor condition based on before/after
  let cursorCondition: Record<string, unknown> = {}
  if (opts.before) {
    const cursorMsg = await db.message.findUnique({
      where: { id: opts.before },
      select: { createdAt: true },
    })
    if (cursorMsg) {
      cursorCondition = { createdAt: { lt: (cursorMsg as Record<string, unknown>).createdAt } }
    }
  } else if (opts.after) {
    const cursorMsg = await db.message.findUnique({
      where: { id: opts.after },
      select: { createdAt: true },
    })
    if (cursorMsg) {
      cursorCondition = { createdAt: { gt: (cursorMsg as Record<string, unknown>).createdAt } }
    }
  }

  // parentId filter: when set, show thread replies for that parent.
  // When not set, show only top-level messages (parentId IS null).
  const parentFilter = opts.parentId !== undefined
    ? { parentId: opts.parentId }
    : { parentId: null }

  // Query with +1 for hasMore detection
  const messages = await db.message.findMany({
    where: { channelId, deletedAt: null, ...parentFilter, ...cursorCondition },
    orderBy: { createdAt: opts.before ? 'desc' : 'asc' },
    take: opts.limit + 1,
    include: { author: { select: AUTHOR_SELECT }, attachments: true },
  })

  const hasMore = messages.length > opts.limit
  if (hasMore) messages.pop()

  // Restore chronological order when paginating backwards
  if (opts.before) messages.reverse()

  // Update lastReadAt silently (fire-and-forget)
  db.channelMember.update({
    where: { channelId_userId: { channelId, userId } },
    data: { lastReadAt: new Date(), unreadCount: 0 },
  }).catch(() => {})

  return {
    messages: messages.map((m: unknown) => shapeMessage(m as Record<string, unknown>)),
    hasMore,
    cursor: messages.length > 0
      ? (messages[messages.length - 1] as Record<string, unknown>).id as string
      : null,
  }
}

// ─── Search Messages (tsvector full-text search) ────────────────────────────

/**
 * Sanitize user input into a valid tsquery string.
 * Splits on whitespace, filters empties, joins with ' & ' for AND semantics.
 */
function sanitizeTsQuery(input: string): string {
  return input
    .split(/\s+/)
    .filter((term) => term.length > 0)
    .map((term) => term.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((term) => term.length > 0)
    .join(' & ')
}

export async function searchMessages(
  userId: string,
  query: { q: string; channelId?: string; limit: number; cursor?: string },
): Promise<{ results: SearchResult[]; hasMore: boolean; cursor: string | null }> {
  const orgId = getOrgContextId()
  const tsQuery = sanitizeTsQuery(query.q)

  if (!tsQuery) {
    return { results: [], hasMore: false, cursor: null }
  }

  const limit = query.limit + 1

  // T-24-09: All parameters use Prisma.sql tagged templates (no raw interpolation)
  // T-24-08: Scoped to org + user's accessible channels via subquery
  let cursorCondition = Prisma.sql``
  if (query.cursor) {
    const cursorMsg = await rawPrisma.message.findUnique({
      where: { id: query.cursor },
      select: { createdAt: true },
    })
    if (cursorMsg) {
      cursorCondition = Prisma.sql`AND m."createdAt" < ${cursorMsg.createdAt}`
    }
  }

  const channelFilter = query.channelId
    ? Prisma.sql`AND m."channelId" = ${query.channelId}`
    : Prisma.sql``

  const rows = await rawPrisma.$queryRaw<Array<{
    id: string
    channelId: string
    channelName: string
    authorId: string
    firstName: string | null
    lastName: string | null
    avatar: string | null
    content: string
    createdAt: Date
  }>>`
    SELECT m.id, m."channelId", c.name as "channelName",
           m."authorId", u."firstName", u."lastName", u.avatar,
           m.content, m."createdAt"
    FROM "Message" m
    JOIN "Channel" c ON c.id = m."channelId"
    JOIN "User" u ON u.id = m."authorId"
    WHERE m."organizationId" = ${orgId}
      AND m."deletedAt" IS NULL
      AND m."channelId" IN (
        SELECT cm."channelId" FROM "ChannelMember" cm WHERE cm."userId" = ${userId}
      )
      AND m."searchVector" @@ to_tsquery('english', ${tsQuery})
      ${channelFilter}
      ${cursorCondition}
    ORDER BY ts_rank(m."searchVector", to_tsquery('english', ${tsQuery})) DESC,
             m."createdAt" DESC
    LIMIT ${limit}
  `

  const hasMore = rows.length > query.limit
  if (hasMore) rows.pop()

  const results: SearchResult[] = rows.map((row) => ({
    id: row.id,
    channelId: row.channelId,
    channelName: row.channelName,
    authorId: row.authorId,
    authorName:
      `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim() || 'Unknown',
    authorAvatar: row.avatar,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }))

  return {
    results,
    hasMore,
    cursor: results.length > 0 ? results[results.length - 1].id : null,
  }
}
