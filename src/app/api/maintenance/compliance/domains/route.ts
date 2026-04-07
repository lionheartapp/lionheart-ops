/**
 * GET /api/maintenance/compliance/domains — list all 10 domain configs for org
 * POST /api/maintenance/compliance/domains — create/update a domain config
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getComplianceDomainConfigs,
  createComplianceDomainConfig,
  populateComplianceCalendar,
} from '@/lib/services/complianceService'
import { logger } from '@/lib/logger'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const schoolId = searchParams.get('schoolId')
  const configs = await getComplianceDomainConfigs(orgId, schoolId)
  return NextResponse.json(ok(configs))
}, { permission: PERMISSIONS.COMPLIANCE_READ })

export const POST = withAuth(async ({ req, orgId }) => {
  const body = await req.json()
  const config = await createComplianceDomainConfig(orgId, body)

  // After configuring, populate compliance calendar for current school year
  const now = new Date()
  const schoolYearStart = now.getMonth() >= 7
    ? new Date(now.getFullYear(), 7, 1) // Aug 1 this year
    : new Date(now.getFullYear() - 1, 7, 1) // Aug 1 last year
  const schoolYearEnd = new Date(schoolYearStart.getFullYear() + 1, 6, 31) // Jul 31 next year

  try {
    await populateComplianceCalendar(orgId, schoolYearStart, schoolYearEnd)
  } catch (popErr) {
    logger.error({ error: String(popErr) }, 'Compliance calendar population failed')
    // Non-fatal — config was saved successfully
  }

  return NextResponse.json(ok(config), { status: 201 })
}, { permission: PERMISSIONS.COMPLIANCE_MANAGE })
