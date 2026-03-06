/**
 * GET /api/maintenance/compliance/domains/[id] — get single domain config
 * PATCH /api/maintenance/compliance/domains/[id] — update domain config
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getComplianceDomainConfigById,
  updateComplianceDomainConfig,
} from '@/lib/services/complianceService'

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
      const config = await getComplianceDomainConfigById(orgId, id)
      if (!config) {
        return NextResponse.json(fail('NOT_FOUND', 'Domain config not found'), { status: 404 })
      }
      return NextResponse.json(ok(config))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/compliance/domains/[id]]', error)
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
      const updated = await updateComplianceDomainConfig(orgId, id, body)
      return NextResponse.json(ok(updated))
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
    console.error('[PATCH /api/maintenance/compliance/domains/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
