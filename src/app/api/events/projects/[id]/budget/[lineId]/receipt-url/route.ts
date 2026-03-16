/**
 * POST /api/events/projects/[id]/budget/[lineId]/receipt-url
 *
 * Generate a signed Supabase Storage upload URL for budget line item receipts.
 * Path: event-receipts/{orgId}/{eventProjectId}/{lineId}/{timestamp}-{filename}
 *
 * Returns { signedUrl, publicUrl, path } — client uploads directly to Supabase,
 * then saves publicUrl to the line item via PATCH /budget/[lineId].
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
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

type Params = { params: Promise<{ id: string; lineId: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: eventProjectId, lineId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_MANAGE)

    const body = await req.json()
    const parsed = UploadUrlSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'fileName and contentType are required'),
        { status: 400 },
      )
    }

    const { fileName, contentType } = parsed.data

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
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message === 'Supabase storage not configured') {
      return NextResponse.json(fail('SERVICE_UNAVAILABLE', 'Storage not configured'), { status: 503 })
    }
    console.error('[POST receipt-url]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
