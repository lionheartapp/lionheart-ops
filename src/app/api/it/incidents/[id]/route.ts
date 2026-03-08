import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getIncidentById, logIncidentView } from '@/lib/services/securityIncidentService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_INCIDENT_READ)

    return await runWithOrgContext(orgId, async () => {
      const incident = await getIncidentById(orgId, id)
      if (!incident) {
        return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
      }

      // Log view (fire-and-forget)
      logIncidentView(orgId, id, ctx.userId).catch(() => {})

      return NextResponse.json(ok(incident))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('GET /api/it/incidents/[id] error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
