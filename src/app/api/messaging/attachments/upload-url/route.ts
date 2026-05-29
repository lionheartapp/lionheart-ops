/**
 * POST /api/messaging/attachments/upload-url
 *
 * Returns a signed upload URL for direct client-to-Supabase Storage uploads.
 * The client uploads the file binary to the signed URL, then includes the
 * resulting storage path when sending the message.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createSignedUploadUrl,
  UploadUrlSchema,
} from '@/lib/services/attachmentService'
import type { z } from 'zod'

export const POST = withAuth<z.infer<typeof UploadUrlSchema>>(
  async ({ ctx, orgId, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked

    const { signedUrl, storagePath } = await createSignedUploadUrl(
      orgId,
      ctx.userId,
      body.channelId,
      body.fileName,
      body.mimeType,
      body.fileSize,
    )

    return NextResponse.json(ok({ signedUrl, storagePath }))
  },
  { permission: PERMISSIONS.MESSAGING_ACCESS, schema: UploadUrlSchema },
)
