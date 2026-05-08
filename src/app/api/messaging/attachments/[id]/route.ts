/**
 * GET /api/messaging/attachments/[id]
 *
 * Redirects to a short-lived signed URL for the attachment file.
 * This avoids needing the Supabase bucket to be publicly accessible.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { fail } from '@/lib/api-response'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { createClient } from '@supabase/supabase-js'

const BUCKET_NAME = 'messaging-attachments'

export const GET = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const db = prisma as unknown as OrgPrismaClient

  // Look up the attachment
  const attachment = await db.messageAttachment.findUnique({
    where: { id: params.id },
    select: { storageUrl: true, messageId: true, mimeType: true, fileName: true },
  })

  if (!attachment) {
    return NextResponse.json(fail('NOT_FOUND', 'Attachment not found'), { status: 404 })
  }

  // Extract the storage path from the stored URL
  const url = (attachment as Record<string, unknown>).storageUrl as string
  const pathMatch = url.match(/messaging-attachments\/(.+)$/)
  if (!pathMatch) {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Invalid storage path'), { status: 500 })
  }
  const storagePath = pathMatch[1]

  // Generate a signed URL (valid for 1 hour)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Storage not configured'), { status: 500 })
  }

  const client = createClient(supabaseUrl, supabaseKey)
  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 3600) // 1 hour

  if (error || !data?.signedUrl) {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to generate download URL'), { status: 500 })
  }

  // Redirect to the signed URL
  return NextResponse.redirect(data.signedUrl)
})
