import { z } from 'zod'
import { prisma } from '@/lib/db'
import { stripAllHtml } from '@/lib/sanitize'

// ============= Validation Schemas =============

export const CreateCommentSchema = z.object({
  body: z.string().min(1, 'Comment body is required').max(5000).transform(stripAllHtml),
})

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>

// ============= Service Functions =============

/**
 * List all comments for a ticket, ordered oldest first.
 * Security: Caller must verify ticket access before calling (e.g., via getTicketById).
 */
export async function listComments(ticketId: string) {
  return prisma.ticketComment.findMany({
    where: { ticketId },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  })
}

/**
 * Create a comment on a ticket.
 * Security: Caller must verify ticket access before calling.
 *
 * @param ticketId - The ticket to comment on
 * @param authorId - The user posting the comment
 * @param input - Comment body
 * @param organizationId - Org ID for multi-tenancy filtering
 */
export async function createComment(
  ticketId: string,
  authorId: string,
  input: { body: string },
  organizationId: string
) {
  const validated = CreateCommentSchema.parse(input)

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId,
      authorId,
      body: validated.body,
      organizationId,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  })

  return comment
}
