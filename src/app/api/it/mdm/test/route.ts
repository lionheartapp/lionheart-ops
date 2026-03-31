/**
 * POST /api/it/mdm/test — test MDM provider connection
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { testConnection } from '@/lib/services/itMdmService'

export const POST = withAuth(async () => {
  const result = await testConnection()
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_MDM_CONFIGURE })
