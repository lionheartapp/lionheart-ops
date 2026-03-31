/**
 * GET /api/it/damage/summary/[batchId] — get damage assessment summary for a batch
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getDamageSummary } from '@/lib/services/itDamageService'

export const GET = withAuth(async ({ params }) => {
  const summary = await getDamageSummary(params.batchId)

  return NextResponse.json(ok(summary))
}, { permission: PERMISSIONS.IT_DAMAGE_ASSESS })
