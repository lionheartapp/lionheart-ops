import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { rejectMaintenanceGate } from '@/lib/services/maintenanceApprovalService'

const RejectSchema = z.object({
  gateKey: z.string().min(1),
  reason: z.string().min(1).max(500),
})

/**
 * POST /api/maintenance/tickets/[id]/reject-gate
 * Reject a specific approval gate on a maintenance ticket.
 */
export const POST = withAuth(async ({ ctx, params, body }) => {
  const { id } = await params
  await rejectMaintenanceGate(id, body.gateKey, ctx.userId, body.reason)
  return NextResponse.json(ok({ rejected: true }))
}, { permission: PERMISSIONS.MAINTENANCE_MANAGE, schema: RejectSchema })
