/**
 * POST /api/events/projects/[id]/budget/[lineId]/receipt-url
 *
 * Generate a signed Supabase Storage upload URL for budget line item receipts.
 * Path: event-receipts/{orgId}/{eventProjectId}/{lineId}/{timestamp}-{filename}
 *
 * Returns { signedUrl, publicUrl, path } — client uploads directly to Supabase,
 * then saves publicUrl to the line item via PATCH /budget/[lineId].
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { createClient } from '@supabase/supabase-js'
import { validateFileUpload, ALLOWED_IMAGE_TYPES } from '@/lib/validation/file-upload'

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

export const POST = withAuth(async ({ params, orgId, body }) => {
  const { id: eventProjectId, lineId } = params
  const { fileName, contentType } = body

  // Validate MIME type before generating a signed URL
  const uploadCheck = validateFileUpload(
    { type: contentType, size: 0, name: fileName },
    { allowedTypes: ALLOWED_IMAGE_TYPES },
  )
  if (!uploadCheck.valid) {
    return NextResponse.json(fail('VALIDATION_ERROR', uploadCheck.error!), { status: 400 })
  }

  const storagePath = `${orgId}/${eventProjectId}/${lineId}/${Date.now()}-${fileName}`

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.storage
    .from('event-receipts')
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    console.error('[receipt-url] Supabase error:', error)
    return NextResponse.json(
      fail('STORAGE_ERROR', 'Failed to generate upload URL'),
      { status: 500 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/event-receipts/${storagePath}`

  return NextResponse.json(ok({ signedUrl: data.signedUrl, publicUrl, path: storagePath }))
}, { permission: PERMISSIONS.EVENTS_BUDGET_MANAGE, schema: UploadUrlSchema })
