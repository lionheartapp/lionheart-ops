/**
 * POST /api/maintenance/assets/upload-url — generate a signed Supabase Storage upload URL
 *
 * Returns a signed URL for client-side direct upload to 'maintenance-assets' bucket.
 * Bypasses Next.js 1MB body limit since the actual upload goes directly to Supabase.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { createClient } from '@supabase/supabase-js'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/validation/file-upload'
import { logger } from '@/lib/logger'

const UploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
})

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !key) {
    throw new Error('Supabase storage not configured')
  }

  return createClient(url, key)
}

export const POST = withAuth(async ({ req, orgId }) => {
  const body = await req.json()
  const parsed = UploadUrlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'fileName and contentType are required'),
      { status: 400 }
    )
  }

  const { fileName, contentType } = parsed.data

  // Validate MIME type before generating a signed URL
  const uploadCheck = validateFileUpload(
    { type: contentType, size: 0, name: fileName },
    { allowedTypes: ALLOWED_IMAGE_TYPES }
  )
  if (!uploadCheck.valid) {
    return NextResponse.json(fail('VALIDATION_ERROR', uploadCheck.error!), { status: 400 })
  }

  const storagePath = `${orgId}/${Date.now()}-${fileName}`

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.storage
    .from('maintenance-assets')
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    logger.error({ error: String(error) }, 'Supabase asset upload URL failed')
    return NextResponse.json(fail('STORAGE_ERROR', 'Failed to generate upload URL'), { status: 500 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/maintenance-assets/${storagePath}`

  return NextResponse.json(ok({
    signedUrl: data.signedUrl,
    publicUrl,
    path: storagePath,
  }))
}, { permission: PERMISSIONS.ASSETS_CREATE })
