import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateIncidentSeverity } from '@/lib/services/securityIncidentService'
import { notifyIncidentSeverityEscalated } from '@/lib/services/securityIncidentNotificationService'
import { prisma } from '@/lib/db'

const UpdateSeveritySchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  justification: z.string().optional(),
})

export const PUT = withAuth(async ({ orgId, ctx, params, body }) => {
  const current = await prisma.securityIncident.findUnique({
    where: { id: params.id },
    select: { severity: true, incidentNumber: true, title: true, type: true, piiInvolved: true, reportedById: true },
  })
  if (!current) {
    return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
  }

  const fromSeverity = current.severity
  const updated = await updateIncidentSeverity(orgId, params.id, ctx.userId, body)

  // Only notify on escalation (higher severity)
  const severityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  const fromIdx = severityOrder.indexOf(fromSeverity)
  const toIdx = severityOrder.indexOf(body.severity)
  if (toIdx > fromIdx) {
    notifyIncidentSeverityEscalated(
      {
        id: params.id,
        incidentNumber: current.incidentNumber,
        title: current.title,
        severity: body.severity,
        type: current.type,
        piiInvolved: current.piiInvolved,
        reportedById: current.reportedById,
      },
      fromSeverity,
      body.severity,
      orgId
    ).catch(() => {})
  }

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.IT_INCIDENT_MANAGE, schema: UpdateSeveritySchema })
