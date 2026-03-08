import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateIncidentStatus } from '@/lib/services/securityIncidentService'
import { notifyIncidentStatusChanged } from '@/lib/services/securityIncidentNotificationService'
import { prisma } from '@/lib/db'

const UpdateStatusSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'CONTAINED', 'REMEDIATING', 'CLOSED']),
  note: z.string().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_INCIDENT_CREATE)

    const body = await req.json()
    const parsed = UpdateStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      // Get current status before update
      const current = await prisma.securityIncident.findUnique({
        where: { id },
        select: { status: true, incidentNumber: true, title: true, severity: true, type: true, piiInvolved: true, reportedById: true },
      })
      if (!current) {
        return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
      }

      const fromStatus = current.status
      const updated = await updateIncidentStatus(orgId, id, ctx.userId, parsed.data)

      // Fire-and-forget notification
      notifyIncidentStatusChanged(
        {
          id,
          incidentNumber: current.incidentNumber,
          title: current.title,
          severity: current.severity,
          type: current.type,
          piiInvolved: current.piiInvolved,
          reportedById: current.reportedById,
        },
        fromStatus,
        parsed.data.status,
        orgId
      ).catch(() => {})

      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Cannot transition')) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    console.error('PUT /api/it/incidents/[id]/status error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
