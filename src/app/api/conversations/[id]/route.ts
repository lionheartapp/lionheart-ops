/**
 * @authOnly Reads and deletes only Leo conversations owned by the signed-in user.
 *
 * GET    /api/conversations/[id] — Get a single conversation
 * DELETE /api/conversations/[id] — Soft-delete a conversation (owner only)
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { getConversation, deleteConversation } from '@/lib/services/ai/conversationService'
import { prisma } from '@/lib/db'

export const GET = withAuth(async ({ orgId, ctx, params }) => {
  const conversation = await getConversation(params.id, orgId, ctx.userId)
  if (!conversation) {
    return NextResponse.json(fail('NOT_FOUND', 'Conversation not found'), { status: 404 })
  }
  return NextResponse.json(ok(conversation))
})

export const DELETE = withAuth(async ({ orgId, ctx, params }) => {
  // Verify conversation belongs to the current user (not just the org)
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: params.id,
      userId: ctx.userId,
    },
    select: { id: true },
  })

  if (!conversation) {
    return NextResponse.json(fail('NOT_FOUND', 'Conversation not found'), { status: 404 })
  }

  await deleteConversation(params.id, orgId)
  return NextResponse.json(ok({ deleted: true }))
})
