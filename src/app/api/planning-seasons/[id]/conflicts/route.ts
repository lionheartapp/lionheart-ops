import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getConflicts } from '@/lib/services/planningSeasonService'

export const GET = withAuth(async ({ params }) => {
  const conflicts = await getConflicts(params.id)
  return NextResponse.json(ok(conflicts))
}, { permission: PERMISSIONS.PLANNING_VIEW })
