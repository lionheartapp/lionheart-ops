/**
 * POST /api/maintenance/compliance/records/[id]/generate-ticket
 *
 * Auto-generate a MaintenanceTicket work order from a compliance record.
 * Supports type='compliance' (default) or type='remediation' (FAILED records only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  generateComplianceTicket,
  generateRemediationTicket,
  getComplianceRecordById,
} from '@/lib/services/complianceService'

const BodySchema = z.object({
  type: z.enum(['compliance', 'remediation']).default('compliance'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.COMPLIANCE_MANAGE)

    const body = await req.json().catch(() => ({}))
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request body'), { status: 400 })
    }
    const { type } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      // For remediation, validate outcome first
      if (type === 'remediation') {
        const record = await getComplianceRecordById(orgId, id)
        if (!record) {
          return NextResponse.json(fail('NOT_FOUND', 'Compliance record not found'), { status: 404 })
        }
        if (record.outcome !== 'FAILED') {
          return NextResponse.json(
            fail('VALIDATION_ERROR', 'Record must have FAILED outcome for remediation ticket'),
            { status: 400 }
          )
        }
        const result = await generateRemediationTicket(orgId, id, ctx.userId)
        return NextResponse.json(ok(result))
      }

      // Default: compliance ticket
      const result = await generateComplianceTicket(orgId, id, ctx.userId)
      return NextResponse.json(ok(result))
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message === 'Record not found') {
        return NextResponse.json(fail('NOT_FOUND', 'Compliance record not found'), { status: 404 })
      }
      if (
        error.message === 'Ticket already generated for this compliance record' ||
        error.message === 'Remediation ticket already generated for this compliance record' ||
        error.message === 'Record must have FAILED outcome for remediation ticket'
      ) {
        return NextResponse.json(fail('CONFLICT', error.message), { status: 409 })
      }
    }
    console.error('[POST /api/maintenance/compliance/records/[id]/generate-ticket]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
