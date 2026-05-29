import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import * as attachmentService from '@/lib/services/scheduleBlockAttachmentService'

/**
 * GET /api/events/projects/[id]/schedule/[blockId]/attachments
 *
 * List all attachments for a schedule block.
 */
export const GET = withAuth(async ({ params }) => {
  const attachments = await attachmentService.listAttachments(params.blockId)
  return NextResponse.json(ok(attachments))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

/**
 * POST /api/events/projects/[id]/schedule/[blockId]/attachments
 *
 * Upload a file attachment to a schedule block.
 * Body: { fileName, fileBase64, contentType }
 */
export const POST = withAuth(async ({ req, params, ctx, orgId }) => {
  const body = await req.json()

  try {
    const attachment = await attachmentService.createAttachment(params.blockId, ctx.userId, body, orgId)
    return NextResponse.json(ok(attachment), { status: 201 })
  } catch (error) {
    // Custom validation for file size/empty errors — not covered by classifyError
    if (error instanceof Error && (
      error.message.includes('size limit') ||
      error.message.includes('File is empty')
    )) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    throw error
  }
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL })
