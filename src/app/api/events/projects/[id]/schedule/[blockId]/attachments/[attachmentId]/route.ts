import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import * as attachmentService from '@/lib/services/scheduleBlockAttachmentService'

/**
 * DELETE /api/events/projects/[id]/schedule/[blockId]/attachments/[attachmentId]
 *
 * Delete a file attachment from a schedule block.
 */
export const DELETE = withAuth(async ({ params }) => {
  const result = await attachmentService.deleteAttachment(params.attachmentId, params.blockId)
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL })
