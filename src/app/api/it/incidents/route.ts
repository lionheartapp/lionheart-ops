import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
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

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_INCIDENT_CREATE)

    const body = await req.json()
    const parsed = CreateIncidentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const incident = await createIncident(orgId, ctx.userId, parsed.data)

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
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('POST /api/it/incidents error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_INCIDENT_READ)

    const url = new URL(req.url)
    const filters = {
      type: url.searchParams.get('type') as SecurityIncidentType | undefined || undefined,
      severity: url.searchParams.get('severity') as IncidentSeverity | undefined || undefined,
      status: url.searchParams.get('status') as any || undefined,
      schoolId: url.searchParams.get('schoolId') || undefined,
      search: url.searchParams.get('search') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      page: url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
    }

    return await runWithOrgContext(orgId, async () => {
      const result = await getIncidents(orgId, filters)
      return NextResponse.json(ok(result))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('GET /api/it/incidents error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
