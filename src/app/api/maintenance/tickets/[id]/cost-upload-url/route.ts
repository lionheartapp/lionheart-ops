/**
 * POST /api/maintenance/tickets/[id]/cost-upload-url
 *
 * Generate a signed Supabase Storage upload URL for receipt photos.
 * Path: maintenance-receipts/{orgId}/{ticketId}/{timestamp}-{filename}
 *
 * Bypasses Next.js 1MB body limit — actual upload goes directly to Supabase.
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { validateFileUpload, sanitizeFileName, ALLOWED_IMAGE_TYPES } from '@/lib/validation/file-upload'
import { logger } from '@/lib/logger'

const UploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
})

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Supabase storage not configured')
  return createClient(url, key)
}

export const POST = withAuth(async ({ req, orgId, params }) => {
  const ticketId = params.id
  const body = await req.json()
  const parsed = UploadUrlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'fileName and contentType are required'),
      { status: 400 }
    )
  }

  const { fileName, contentType } = parsed.data

  // Validate MIME type before generating a signed URL (receipts are images)
  const uploadCheck = validateFileUpload(
    { type: contentType, size: 0, name: fileName },
    { allowedTypes: ALLOWED_IMAGE_TYPES }
  )
  if (!uploadCheck.valid) {
    return NextResponse.json(fail('VALIDATION_ERROR', uploadCheck.error!), { status: 400 })
  }

  const storagePath = `${orgId}/${ticketId}/${Date.now()}-${sanitizeFileName(fileName)}`

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.storage
      .from('maintenance-receipts')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      logger.error({ error: String(error) }, 'Supabase cost upload URL failed')
      return NextResponse.json(fail('STORAGE_ERROR', 'Failed to generate upload URL'), { status: 500 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/maintenance-receipts/${storagePath}`

    return NextResponse.json(ok({
      signedUrl: data.signedUrl,
      publicUrl,
      path: storagePath,
    }))
  } catch (error) {
    if (error instanceof Error && error.message === 'Supabase storage not configured') {
      return NextResponse.json(fail('SERVICE_UNAVAILABLE', 'Storage not configured'), { status: 503 })
    }
    throw error
  }
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })
