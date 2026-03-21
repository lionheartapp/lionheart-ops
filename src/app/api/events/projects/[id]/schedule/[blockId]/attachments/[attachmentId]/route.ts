import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as attachmentService from '@/lib/services/scheduleBlockAttachmentService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/schedule/[blockId]/attachments/[attachmentId]' })

type RouteParams = {
  params: Promise<{ id: string; blockId: string; attachmentId: string }>
}

/**
 * DELETE /api/events/projects/[id]/schedule/[blockId]/attachments/[attachmentId]
 *
 * Delete a file attachment from a schedule block.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { blockId, attachmentId } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    return await runWithOrgContext(orgId, async () => {
      const result = await attachmentService.deleteAttachment(attachmentId, blockId)
      return NextResponse.json(ok(result))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', error instanceof Error ? error.message : 'Unauthorized'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    log.error({ err: error }, 'Failed to delete block attachment')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
