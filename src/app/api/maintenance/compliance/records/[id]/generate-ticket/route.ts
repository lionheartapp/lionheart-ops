/**
 * POST /api/maintenance/compliance/records/[id]/generate-ticket
 *
 * Auto-generate a MaintenanceTicket work order from a compliance record.
 * Supports type='compliance' (default) or type='remediation' (FAILED records only).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  generateComplianceTicket,
  generateRemediationTicket,
  getComplianceRecordById,
} from '@/lib/services/complianceService'

const BodySchema = z.object({
  type: z.enum(['compliance', 'remediation']).default('compliance'),
})

export const POST = withAuth(async ({ req, orgId, ctx, params }) => {
  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request body'), { status: 400 })
  }
  const { type } = parsed.data

  // For remediation, validate outcome first
  if (type === 'remediation') {
    const record = await getComplianceRecordById(orgId, params.id)
    if (!record) {
      return NextResponse.json(fail('NOT_FOUND', 'Compliance record not found'), { status: 404 })
    }
    if (record.outcome !== 'FAILED') {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Record must have FAILED outcome for remediation ticket'),
        { status: 400 }
      )
    }
    const result = await generateRemediationTicket(orgId, params.id, ctx.userId)
    return NextResponse.json(ok(result))
  }

  // Default: compliance ticket
  const result = await generateComplianceTicket(orgId, params.id, ctx.userId)
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.COMPLIANCE_MANAGE })
