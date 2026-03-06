/**
 * GET /api/maintenance/compliance/domains — list all 10 domain configs for org
 * POST /api/maintenance/compliance/domains — create/update a domain config
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getComplianceDomainConfigs,
  createComplianceDomainConfig,
  populateComplianceCalendar,
} from '@/lib/services/complianceService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.COMPLIANCE_READ)

    const schoolId = req.nextUrl.searchParams.get('schoolId')

    return await runWithOrgContext(orgId, async () => {
      const configs = await getComplianceDomainConfigs(orgId, schoolId)
      return NextResponse.json(ok(configs))
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
    }
    console.error('[GET /api/maintenance/compliance/domains]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.COMPLIANCE_MANAGE)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
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
        console.error('[POST /api/maintenance/compliance/domains] Calendar population failed:', popErr)
        // Non-fatal — config was saved successfully
      }

      return NextResponse.json(ok(config), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data'), { status: 400 })
      }
    }
    console.error('[POST /api/maintenance/compliance/domains]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
