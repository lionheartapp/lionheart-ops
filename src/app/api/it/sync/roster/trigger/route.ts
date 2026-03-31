/**
 * POST /api/it/sync/roster/trigger — manual roster sync (Clever/ClassLink)
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { syncRoster } from '@/lib/services/rosterSyncService'

export const POST = withAuth(async ({ req, orgId }) => {
  const body = await req.json().catch(() => ({}))
  const provider = (body as { provider?: string }).provider || 'clever'

  const result = await syncRoster(orgId, provider)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_ROSTER_SYNC })
