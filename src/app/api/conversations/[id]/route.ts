/**
 * GET    /api/conversations/[id] — Get a single conversation
 * DELETE /api/conversations/[id] — Soft-delete a conversation (owner only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { getConversation, deleteConversation } from '@/lib/services/ai/conversationService'
import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = logger.child({ route: '/api/conversations/[id]', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const conversation = await getConversation(id, orgId)
      if (!conversation) {
        return NextResponse.json(fail('NOT_FOUND', 'Conversation not found'), { status: 404 })
      }
      return NextResponse.json(ok(conversation))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to get conversation')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = logger.child({ route: '/api/conversations/[id]', method: 'DELETE' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      // Verify conversation belongs to the current user (not just the org)
      const conversation = await rawPrisma.conversation.findFirst({
        where: {
          id,
          organizationId: orgId,
          userId: ctx.userId,
          deletedAt: null,
        },
        select: { id: true },
      })

      if (!conversation) {
        return NextResponse.json(fail('NOT_FOUND', 'Conversation not found'), { status: 404 })
      }

      await deleteConversation(id, orgId)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to delete conversation')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
