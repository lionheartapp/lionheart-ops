import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updateIncidentStatus } from '@/lib/services/securityIncidentService'
import { notifyIncidentStatusChanged } from '@/lib/services/securityIncidentNotificationService'
import { prisma } from '@/lib/db'

const UpdateStatusSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'CONTAINED', 'REMEDIATING', 'CLOSED']),
  note: z.string().optional(),
})

export const PUT = withAuth(async ({ orgId, ctx, params, body }) => {
  // Get current status before update
  const current = await prisma.securityIncident.findUnique({
    where: { id: params.id },
    select: { status: true, incidentNumber: true, title: true, severity: true, type: true, piiInvolved: true, reportedById: true },
  })
  if (!current) {
    return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
  }

  const fromStatus = current.status
  const updated = await updateIncidentStatus(orgId, params.id, ctx.userId, body)

  // Fire-and-forget notification
  notifyIncidentStatusChanged(
    {
      id: params.id,
      incidentNumber: current.incidentNumber,
      title: current.title,
      severity: current.severity,
      type: current.type,
      piiInvolved: current.piiInvolved,
      reportedById: current.reportedById,
    },
    fromStatus,
    body.status,
    orgId
  ).catch(() => {})

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.IT_INCIDENT_CREATE, schema: UpdateStatusSchema })
