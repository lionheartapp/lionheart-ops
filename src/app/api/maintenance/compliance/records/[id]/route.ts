/**
 * GET /api/maintenance/compliance/records/[id] — get compliance record detail
 * PATCH /api/maintenance/compliance/records/[id] — update outcome/inspector/notes/attachments
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getComplianceRecordById, updateComplianceRecord } from '@/lib/services/complianceService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.COMPLIANCE_READ)

    return await runWithOrgContext(orgId, async () => {
      const record = await getComplianceRecordById(orgId, id)
      if (!record) {
        return NextResponse.json(fail('NOT_FOUND', 'Compliance record not found'), { status: 404 })
      }
      return NextResponse.json(ok(record))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/compliance/records/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.COMPLIANCE_MANAGE)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const updated = await updateComplianceRecord(orgId, id, body)
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message === 'Record not found') {
        return NextResponse.json(fail('NOT_FOUND', 'Compliance record not found'), { status: 404 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data'), { status: 400 })
      }
    }
    console.error('[PATCH /api/maintenance/compliance/records/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
