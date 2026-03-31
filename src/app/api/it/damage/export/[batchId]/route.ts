/**
 * GET /api/it/damage/export/[batchId] — export damage report as CSV
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { exportDamageReport } from '@/lib/services/itDamageService'

export const GET = withAuth(async ({ params }) => {
  const csv = await exportDamageReport(params.batchId)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="damage-report-${params.batchId}.csv"`,
    },
  })
}, { permission: PERMISSIONS.IT_DAMAGE_EXPORT })
