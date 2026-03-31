import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { createIncident, getIncidents } from '@/lib/services/securityIncidentService'
import { notifyIncidentCreated } from '@/lib/services/securityIncidentNotificationService'
import type { SecurityIncidentType, IncidentSeverity } from '@prisma/client'

const CreateIncidentSchema = z.object({
  type: z.enum(['PHISHING', 'DEVICE_LOST_STOLEN', 'UNAUTHORIZED_ACCESS', 'MALWARE', 'DATA_BREACH', 'ACCOUNT_COMPROMISE', 'RANSOMWARE', 'POLICY_VIOLATION', 'OTHER']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  title: z.string().min(1).max(500),
  description: z.string().min(1),
  schoolId: z.string().optional(),
  affectedSystems: z.array(z.string()).optional(),
  affectedDeviceIds: z.array(z.string()).optional(),
  affectedUserIds: z.array(z.string()).optional(),
  piiInvolved: z.boolean().optional(),
})

export const POST = withAuth(async ({ orgId, ctx, body }) => {
  const incident = await createIncident(orgId, ctx.userId, body)

  // Fire-and-forget notifications
  notifyIncidentCreated(
    {
      id: incident.id,
      incidentNumber: incident.incidentNumber,
      title: incident.title,
      severity: incident.severity,
      type: incident.type,
      piiInvolved: incident.piiInvolved,
      reportedById: incident.reportedById,
    },
    orgId
  ).catch(() => {})

  return NextResponse.json(ok(incident), { status: 201 })
}, { permission: PERMISSIONS.IT_INCIDENT_CREATE, schema: CreateIncidentSchema })

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const filters = {
    type: searchParams.get('type') as SecurityIncidentType | undefined || undefined,
    severity: searchParams.get('severity') as IncidentSeverity | undefined || undefined,
    status: searchParams.get('status') as any || undefined,
    schoolId: searchParams.get('schoolId') || undefined,
    search: searchParams.get('search') || undefined,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
  }

  const result = await getIncidents(orgId, filters)
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_INCIDENT_READ })
