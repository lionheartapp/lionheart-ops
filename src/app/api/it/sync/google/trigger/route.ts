/**
 * POST /api/it/sync/google/trigger — manual Google Admin Chromebook sync
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { syncChromebooks } from '@/lib/services/googleAdminService'

export const POST = withAuth(async ({ orgId }) => {
  const result = await syncChromebooks(orgId)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_DEVICE_SYNC })
