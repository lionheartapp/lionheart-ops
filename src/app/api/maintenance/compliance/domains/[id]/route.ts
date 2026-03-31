/**
 * GET /api/maintenance/compliance/domains/[id] — get single domain config
 * PATCH /api/maintenance/compliance/domains/[id] — update domain config
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getComplianceDomainConfigById,
  updateComplianceDomainConfig,
} from '@/lib/services/complianceService'

export const GET = withAuth(async ({ orgId, params }) => {
  const config = await getComplianceDomainConfigById(orgId, params.id)
  if (!config) {
    return NextResponse.json(fail('NOT_FOUND', 'Domain config not found'), { status: 404 })
  }
  return NextResponse.json(ok(config))
}, { permission: PERMISSIONS.COMPLIANCE_READ })

export const PATCH = withAuth(async ({ req, orgId, params }) => {
  const body = await req.json()
  const updated = await updateComplianceDomainConfig(orgId, params.id, body)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.COMPLIANCE_MANAGE })
