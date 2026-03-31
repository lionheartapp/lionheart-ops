import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { closeIncident } from '@/lib/services/securityIncidentService'
import { notifyIncidentClosed } from '@/lib/services/securityIncidentNotificationService'
import { prisma } from '@/lib/db'

const CloseIncidentSchema = z.object({
  resolutionSummary: z.string().min(1, 'Resolution summary is required'),
  lessonsLearned: z.string().optional(),
})

export const POST = withAuth(async ({ orgId, ctx, params, body }) => {
  // Get incident snapshot for notification
  const current = await prisma.securityIncident.findUnique({
    where: { id: params.id },
    select: { incidentNumber: true, title: true, severity: true, type: true, piiInvolved: true, reportedById: true },
  })
  if (!current) {
    return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
  }

  const updated = await closeIncident(orgId, params.id, ctx.userId, body)

  // Fire-and-forget notification
  notifyIncidentClosed(
    {
      id: params.id,
      incidentNumber: current.incidentNumber,
      title: current.title,
      severity: current.severity,
      type: current.type,
      piiInvolved: current.piiInvolved,
      reportedById: current.reportedById,
    },
    orgId
  ).catch(() => {})

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.IT_INCIDENT_MANAGE, schema: CloseIncidentSchema })
