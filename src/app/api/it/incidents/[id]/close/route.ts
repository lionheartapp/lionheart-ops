import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { closeIncident } from '@/lib/services/securityIncidentService'
import { notifyIncidentClosed } from '@/lib/services/securityIncidentNotificationService'
import { prisma } from '@/lib/db'

const CloseIncidentSchema = z.object({
  resolutionSummary: z.string().min(1, 'Resolution summary is required'),
  lessonsLearned: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_INCIDENT_MANAGE)

    const body = await req.json()
    const parsed = CloseIncidentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      // Get incident snapshot for notification
      const current = await prisma.securityIncident.findUnique({
        where: { id },
        select: { incidentNumber: true, title: true, severity: true, type: true, piiInvolved: true, reportedById: true },
      })
      if (!current) {
        return NextResponse.json(fail('NOT_FOUND', 'Incident not found'), { status: 404 })
      }

      const updated = await closeIncident(orgId, id, ctx.userId, parsed.data)

      // Fire-and-forget notification
      notifyIncidentClosed(
        {
          id,
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
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('already closed')) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    console.error('POST /api/it/incidents/[id]/close error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
