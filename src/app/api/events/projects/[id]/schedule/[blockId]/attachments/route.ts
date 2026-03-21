import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as attachmentService from '@/lib/services/scheduleBlockAttachmentService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/schedule/[blockId]/attachments' })

type RouteParams = {
  params: Promise<{ id: string; blockId: string }>
}

/**
 * GET /api/events/projects/[id]/schedule/[blockId]/attachments
 *
 * List all attachments for a schedule block.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { blockId } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      const attachments = await attachmentService.listAttachments(blockId)
      return NextResponse.json(ok(attachments))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', error instanceof Error ? error.message : 'Unauthorized'), { status: 401 })
    }
    log.error({ err: error }, 'Failed to fetch block attachments')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/events/projects/[id]/schedule/[blockId]/attachments
 *
 * Upload a file attachment to a schedule block.
 * Body: { fileName, fileBase64, contentType }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { blockId } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const attachment = await attachmentService.createAttachment(blockId, ctx.userId, body, orgId)
      return NextResponse.json(ok(attachment), { status: 201 })
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', error instanceof Error ? error.message : 'Unauthorized'), { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && (
      error.message.includes('size limit') ||
      error.message.includes('File is empty')
    )) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    log.error({ err: error }, 'Failed to upload block attachment')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
