/**
 * POST /api/maintenance/tickets/upload-url — generate a signed Supabase Storage upload URL
 *
 * Returns a signed URL for client-side direct upload to 'maintenance-photos' bucket.
 * Bypasses Next.js 1MB body limit since the actual upload goes directly to Supabase.
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/validation/file-upload'

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

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.storage
      .from('maintenance-photos')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('[upload-url] Supabase error:', error)
      return NextResponse.json(fail('STORAGE_ERROR', 'Failed to generate upload URL'), { status: 500 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/maintenance-photos/${storagePath}`

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
}, { permission: PERMISSIONS.MAINTENANCE_SUBMIT })
