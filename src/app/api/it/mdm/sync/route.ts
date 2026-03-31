/**
 * POST /api/it/mdm/sync — trigger MDM device sync
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { syncDevices } from '@/lib/services/itMdmService'

export const POST = withAuth(async () => {
  const result = await syncDevices()
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_MDM_SYNC })
