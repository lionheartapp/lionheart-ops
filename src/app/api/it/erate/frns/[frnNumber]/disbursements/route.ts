/**
 * GET /api/it/erate/frns/[frnNumber]/disbursements — disbursements for one FRN.
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { listDisbursements } from '@/lib/services/it/erate-sync'

export const GET = withAuth<unknown, { frnNumber: string }>(
  async ({ orgId, params }) => {
    const rows = await listDisbursements(orgId, params.frnNumber)
    return NextResponse.json(ok(rows))
  },
  { permission: PERMISSIONS.IT_ERATE_VIEW }
)
