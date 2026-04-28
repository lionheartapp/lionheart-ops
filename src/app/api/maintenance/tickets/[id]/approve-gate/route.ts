import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { approveMaintenanceGate } from '@/lib/services/maintenanceApprovalService'

const ApproveSchema = z.object({
  gateKey: z.string().min(1),
})

/**
 * POST /api/maintenance/tickets/[id]/approve-gate
 * Approve a specific approval gate on a maintenance ticket.
 */
export const POST = withAuth(async ({ ctx, params, body }) => {
  const { id } = await params
  const result = await approveMaintenanceGate(id, body.gateKey, ctx.userId)
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.MAINTENANCE_MANAGE, schema: ApproveSchema })
