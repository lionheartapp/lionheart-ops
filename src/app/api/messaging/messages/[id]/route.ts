/**
 * PATCH  /api/messaging/messages/[id] — edit own message OR pin/unpin (D-09, D-05, T-24-19)
 * DELETE /api/messaging/messages/[id] — soft-delete message (D-08, T-24-20)
 *
 * PATCH supports two operations:
 * - Edit: { content: "new text" } — ownership verified in service layer
 * - Pin/Unpin: { pinnedAt: "now" | null } — requires MESSAGING_CHANNELS_MODERATE
 *
 * T-27-02: Pin permission check before allowing pin/unpin.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import {
  editMessage,
  deleteMessage,
} from '@/lib/services/messageService'

// Combined schema: content for edit, pinnedAt for pin toggle
const PatchMessageSchema = z.object({
  content: z.string().min(1).max(4000).trim().optional(),
  pinnedAt: z.union([z.literal('now'), z.null()]).optional(),
}).refine(
  (data) => data.content !== undefined || data.pinnedAt !== undefined,
  { message: 'Either content or pinnedAt must be provided' },
)

type PatchMessageBody = z.infer<typeof PatchMessageSchema>

// PATCH /api/messaging/messages/[id] — edit message or toggle pin
export const PATCH = withAuth<PatchMessageBody, { id: string }>(
  async ({ ctx, orgId, params, body, permissions }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked

    const db = prisma as unknown as OrgPrismaClient

    // Handle pin/unpin
    if (body.pinnedAt !== undefined) {
      // T-27-02: Only users with MESSAGING_CHANNELS_MODERATE can pin/unpin
      const canModerate = await permissions.can(PERMISSIONS.MESSAGING_CHANNELS_MODERATE)
      if (!canModerate) {
        throw new Error('Insufficient permissions')
      }

      const pinnedValue = body.pinnedAt === 'now' ? new Date() : null

      const updated = await db.message.update({
        where: { id: params.id },
        data: { pinnedAt: pinnedValue },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
      })

      const row = updated as Record<string, unknown>
      const author = row.author as {
        id: string
        firstName?: string | null
        lastName?: string | null
        avatar?: string | null
      } | null

      return NextResponse.json(ok({
        id: row.id as string,
        channelId: row.channelId as string,
        authorId: author?.id ?? (row.authorId as string),
        authorName: author
          ? `${author.firstName ?? ''} ${author.lastName ?? ''}`.trim() || 'Unknown'
          : 'Unknown',
        authorAvatar: author?.avatar ?? null,
        content: row.content as string,
        parentId: (row.parentId as string | null) ?? null,
        replyCount: (row.replyCount as number) ?? 0,
        editedAt: row.editedAt ? (row.editedAt as Date).toISOString() : null,
        pinnedAt: row.pinnedAt ? (row.pinnedAt as Date).toISOString() : null,
        createdAt: (row.createdAt as Date).toISOString(),
      }))
    }

    // Handle content edit (existing behavior)
    if (body.content) {
      const updated = await editMessage(params.id, ctx.userId, { content: body.content })
      return NextResponse.json(ok(updated))
    }

    // Should not reach here due to schema refinement
    return NextResponse.json(ok(null))
  },
  { schema: PatchMessageSchema },
)

// DELETE /api/messaging/messages/[id] — soft-delete message
// Own messages: always allowed. Others' messages: requires MESSAGING_MESSAGES_DELETE_ANY
export const DELETE = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params, permissions }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked
  const canDeleteAny = await permissions.can(PERMISSIONS.MESSAGING_MESSAGES_DELETE_ANY)
  const result = await deleteMessage(params.id, ctx.userId, canDeleteAny)
  return NextResponse.json(ok(result))
})
