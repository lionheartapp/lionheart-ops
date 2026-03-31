/**
 * GET /api/maintenance/compliance/records/[id] — get compliance record detail
 * PATCH /api/maintenance/compliance/records/[id] — update outcome/inspector/notes/attachments
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getComplianceRecordById, updateComplianceRecord } from '@/lib/services/complianceService'

export const GET = withAuth(async ({ orgId, params }) => {
  const record = await getComplianceRecordById(orgId, params.id)
  if (!record) {
    return NextResponse.json(fail('NOT_FOUND', 'Compliance record not found'), { status: 404 })
  }
  return NextResponse.json(ok(record))
}, { permission: PERMISSIONS.COMPLIANCE_READ })

export const PATCH = withAuth(async ({ req, orgId, params }) => {
  const body = await req.json()
  const updated = await updateComplianceRecord(orgId, params.id, body)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.COMPLIANCE_MANAGE })
