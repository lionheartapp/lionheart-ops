/**
 * GET /api/it/loaners — loaner pool status + list
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getPool } from '@/lib/services/itLoanerService'

export const GET = withAuth(async () => {
  const pool = await getPool()

  return NextResponse.json(ok(pool))
}, { permission: PERMISSIONS.IT_DEVICE_READ })
