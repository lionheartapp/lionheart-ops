import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateIncidentSeverity } from '@/lib/services/securityIncidentService'
import { notifyIncidentSeverityEscalated } from '@/lib/services/securityIncidentNotificationService'
import { prisma } from '@/lib/db'

const UpdateSeveritySchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  justification: z.string().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_INCIDENT_MANAGE)

    const body = await req.json()
    const parsed = UpdateSeveritySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const current = await prisma.securityIncident.findUnique({
        where: { id },
        select: { severity: true, incidentNumber: true, title: true, type: true, piiInvolved: true, reportedById: true },
      })
      if (!current) {
        return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
      }

      const fromSeverity = current.severity
      const updated = await updateIncidentSeverity(orgId, id, ctx.userId, parsed.data)

      // Only notify on escalation (higher severity)
      const severityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
      const fromIdx = severityOrder.indexOf(fromSeverity)
      const toIdx = severityOrder.indexOf(parsed.data.severity)
      if (toIdx > fromIdx) {
        notifyIncidentSeverityEscalated(
          {
            id,
            incidentNumber: current.incidentNumber,
            title: current.title,
            severity: parsed.data.severity,
            type: current.type,
            piiInvolved: current.piiInvolved,
            reportedById: current.reportedById,
          },
          fromSeverity,
          parsed.data.severity,
          orgId
        ).catch(() => {})
      }

      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Cannot modify closed')) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    console.error('PUT /api/it/incidents/[id]/severity error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
