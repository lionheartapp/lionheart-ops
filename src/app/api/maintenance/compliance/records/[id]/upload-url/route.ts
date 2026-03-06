/**
 * POST /api/maintenance/compliance/records/[id]/upload-url
 *
 * Generate a Supabase signed upload URL for a compliance document attachment.
 * Client should then PUT the file to the signed URL, then PATCH the record to append the fileUrl.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getComplianceRecordById } from '@/lib/services/complianceService'

const BUCKET = 'compliance-docs'

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const BodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
})

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error('Supabase credentials not configured')
  }
  return { client: createClient(url, key), url }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.COMPLIANCE_MANAGE)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'filename and contentType are required'), { status: 400 })
    }
    const { filename, contentType } = parsed.data

    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Unsupported file type. Allowed: images, PDF, Word, Excel'),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      // Verify record exists
      const record = await getComplianceRecordById(orgId, id)
      if (!record) {
        return NextResponse.json(fail('NOT_FOUND', 'Compliance record not found'), { status: 404 })
      }

      // Build storage path
      const timestamp = Date.now()
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${orgId}/${id}/${timestamp}-${safeName}`

      // Generate signed upload URL (1 hour expiry)
      const { client, url: supabaseUrl } = getSupabaseClient()
      const { data, error } = await client.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath)

      if (error || !data) {
        console.error('[upload-url] Supabase signed URL error:', error)
        return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to generate upload URL'), { status: 500 })
      }

      // The public file URL (after upload completes)
      const fileUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`

      return NextResponse.json(ok({ uploadUrl: data.signedUrl, fileUrl, storagePath }))
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
    }
    console.error('[POST /api/maintenance/compliance/records/[id]/upload-url]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
