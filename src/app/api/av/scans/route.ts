import { NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import {
  assertCanUseAV,
  listScans,
  uploadScan,
  UploadScanSchema,
} from '@/lib/services/avRfService'
import { PERMISSIONS } from '@/lib/permissions'

export const GET = withAuth(async ({ orgId, ctx }) => {
  await assertCanUseAV(ctx.userId)
  return NextResponse.json(ok(await listScans(orgId)))
})

export const POST = withAuth(async ({ orgId, ctx, body }) => {
  await assertCanUseAV(ctx.userId, PERMISSIONS.AV_SCAN_UPLOAD)
  try {
    return NextResponse.json(ok(await uploadScan(orgId, ctx.userId, body)), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid scan file') {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid scan file', (error as Error & { details?: unknown }).details), { status: 400 })
    }
    throw error
  }
}, { schema: UploadScanSchema })

