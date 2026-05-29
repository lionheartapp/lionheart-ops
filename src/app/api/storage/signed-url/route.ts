/**
 * POST /api/storage/signed-url — generate a short-lived signed download URL
 *
 * Replaces public bucket URLs with authenticated, time-limited access.
 * The client sends the storage path (bucket + object path), and this endpoint
 * verifies the user is in the owning org before returning a signed URL.
 *
 * The storage path must start with the user's orgId to prevent cross-tenant access.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { createClient } from '@supabase/supabase-js'
import { PERMISSIONS } from '@/lib/permissions'

const ALLOWED_BUCKETS = new Set([
  'maintenance-photos',
  'maintenance-assets',
  'maintenance-receipts',
  'event-receipts',
  'compliance-docs',
  'messaging-attachments',
  'logos',
])

const SignedUrlSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
})

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) throw new Error('Supabase storage not configured')
  return createClient(url, key)
}

/**
 * @authOnly Generates signed URLs only for org-prefixed paths; sensitive buckets require matching permissions.
 */
export const POST = withAuth(async ({ orgId, body, permissions }) => {
  const { bucket, path } = body

  // Validate bucket is on the allowlist
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid storage bucket'), { status: 400 })
  }

  // Verify the path belongs to this org (paths are prefixed with orgId)
  if (!path.startsWith(`${orgId}/`)) {
    return NextResponse.json(fail('FORBIDDEN', 'Access denied'), { status: 403 })
  }

  const allowed =
    bucket === 'logos' ||
    (bucket === 'messaging-attachments' && (await permissions.can(PERMISSIONS.MESSAGING_ACCESS))) ||
    (bucket === 'compliance-docs' && (await permissions.can(PERMISSIONS.SETTINGS_UPDATE))) ||
    (bucket === 'event-receipts' && (await permissions.can(PERMISSIONS.EVENTS_READ))) ||
    (bucket.startsWith('maintenance-') && (await permissions.canAny([
      PERMISSIONS.MAINTENANCE_READ_ALL,
      PERMISSIONS.MAINTENANCE_CLAIM,
      PERMISSIONS.MAINTENANCE_ASSIGN,
    ])))

  if (!allowed) {
    return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to access this file'), { status: 403 })
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 300) // 5-minute expiry

  if (error || !data?.signedUrl) {
    return NextResponse.json(fail('STORAGE_ERROR', 'Failed to generate download URL'), { status: 500 })
  }

  return NextResponse.json(ok({ signedUrl: data.signedUrl }))
}, { schema: SignedUrlSchema })
