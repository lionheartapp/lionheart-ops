/**
 * Conversation Service
 *
 * CRUD operations for Leo's persisted conversation history.
 * Uses rawPrisma with explicit org scoping for all queries.
 */

import { rawPrisma } from '@/lib/db'

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Create a new conversation for a user.
 * Title is optional — can be set later from the first user message.
 */
export async function createConversation(
  userId: string,
  orgId: string,
  title?: string
): Promise<{ id: string }> {
  const conversation = await rawPrisma.conversation.create({
    data: {
      userId,
      organizationId: orgId,
      title: title ?? null,
    },
    select: { id: true },
  })
  return conversation
}

/**
 * Add a message to an existing conversation.
 * Returns the created message ID.
 */
export async function addMessage(
  conversationId: string,
  opts: {
    role: string
    content: string
    tokenCount?: number
    toolName?: string
    toolSuccess?: boolean
    organizationId: string
  }
): Promise<{ id: string }> {
  const message = await rawPrisma.conversationMessage.create({
    data: {
      conversationId,
      organizationId: opts.organizationId,
      role: opts.role,
      content: opts.content,
      tokenCount: opts.tokenCount ?? null,
      toolName: opts.toolName ?? null,
      toolSuccess: opts.toolSuccess ?? null,
    },
    select: { id: true },
  })

  // Bump conversation updatedAt so ordering by updatedAt reflects latest message
  await rawPrisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })

  return message
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * List conversations for a user, ordered by most recently updated.
 * Includes message count per conversation.
 */
export async function getConversations(
  userId: string,
  orgId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<Array<{ id: string; title: string | null; updatedAt: Date; messageCount: number }>> {
  const limit = opts.limit ?? 20
  const offset = opts.offset ?? 0

  const conversations = await rawPrisma.conversation.findMany({
    where: {
      userId,
      organizationId: orgId,
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: {
        select: { messages: true },
      },
    },
  })

  return conversations.map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updatedAt,
    messageCount: c._count.messages,
  }))
}

/**
 * Get a single conversation by ID, scoped to an org.
 * Returns null if not found or soft-deleted.
 */
export async function getConversation(
  conversationId: string,
  orgId: string
): Promise<{ id: string; title: string | null; createdAt: Date; updatedAt: Date } | null> {
  return rawPrisma.conversation.findFirst({
    where: {
      id: conversationId,
      organizationId: orgId,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

/**
 * Get all messages for a conversation, ordered oldest first.
 */
export async function getMessages(
  conversationId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<
  Array<{
    id: string
    role: string
    content: string
    feedbackScore: number | null
    toolName: string | null
    createdAt: Date
  }>
> {
  const limit = opts.limit ?? 100
  const offset = opts.offset ?? 0

  return rawPrisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      role: true,
      content: true,
      feedbackScore: true,
      toolName: true,
      createdAt: true,
    },
  })
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Update the title of a conversation (e.g., auto-set from first user message).
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  await rawPrisma.conversation.update({
    where: { id: conversationId },
    data: { title },
  })
}

/**
 * Record user feedback on an assistant message.
 * feedbackScore: 1 = thumbs down, 5 = thumbs up.
 */
export async function setMessageFeedback(
  messageId: string,
  feedbackScore: number
): Promise<void> {
  await rawPrisma.conversationMessage.update({
    where: { id: messageId },
    data: { feedbackScore },
  })
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Soft-delete a conversation by setting deletedAt.
 * Scoped to orgId to prevent cross-org deletion.
 */
export async function deleteConversation(
  conversationId: string,
  orgId: string
): Promise<void> {
  await rawPrisma.conversation.updateMany({
    where: {
      id: conversationId,
      organizationId: orgId,
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  })
}
