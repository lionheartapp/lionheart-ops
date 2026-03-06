/**
 * POST /api/maintenance/tickets/[id]/cost-upload-url
 *
 * Generate a signed Supabase Storage upload URL for receipt photos.
 * Path: maintenance-receipts/{orgId}/{ticketId}/{timestamp}-{filename}
 *
 * Bypasses Next.js 1MB body limit — actual upload goes directly to Supabase.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { createClient } from '@supabase/supabase-js'

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

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: ticketId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_CLAIM)

    const body = await req.json()
    const parsed = UploadUrlSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'fileName and contentType are required'),
        { status: 400 }
      )
    }

    const { fileName, contentType } = parsed.data
    const storagePath = `${orgId}/${ticketId}/${Date.now()}-${fileName}`

    const supabase = getSupabaseClient()
    const { data, error } = await supabase.storage
      .from('maintenance-receipts')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('[cost-upload-url] Supabase error:', error)
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
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message === 'Supabase storage not configured') {
      return NextResponse.json(fail('SERVICE_UNAVAILABLE', 'Storage not configured'), { status: 503 })
    }
    console.error('[POST /api/maintenance/tickets/[id]/cost-upload-url]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
