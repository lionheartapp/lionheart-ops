/**
 * GET /api/it/summer/staging — get staging area device counts
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getStagingCounts } from '@/lib/services/itSummerService'

export const GET = withAuth(async () => {
  const counts = await getStagingCounts()

  return NextResponse.json(ok(counts))
}, { permission: PERMISSIONS.IT_SUMMER_MANAGE })
