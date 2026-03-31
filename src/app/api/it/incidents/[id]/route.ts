import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getIncidentById, logIncidentView } from '@/lib/services/securityIncidentService'

export const GET = withAuth(async ({ orgId, ctx, params }) => {
  const incident = await getIncidentById(orgId, params.id)
  if (!incident) {
    return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
  }

  // Log view (fire-and-forget)
  logIncidentView(orgId, params.id, ctx.userId).catch(() => {})

  return NextResponse.json(ok(incident))
}, { permission: PERMISSIONS.IT_INCIDENT_READ })
