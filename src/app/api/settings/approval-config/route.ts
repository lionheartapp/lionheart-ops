import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getApprovalConfigs, bulkUpsertApprovalConfigs } from '@/lib/services/approvalConfigService'

const ConfigSchema = z.object({
  channelType: z.enum(['ADMIN', 'FACILITIES', 'AV_PRODUCTION', 'CUSTODIAL', 'SECURITY', 'ATHLETIC_DIRECTOR']),
  mode: z.enum(['REQUIRED', 'NOTIFICATION', 'DISABLED']),
  assignedTeamId: z.string().nullable().optional(),
  escalationHours: z.number().int().min(1).max(720).optional(),
  autoApproveIfNoResource: z.boolean().optional(),
  campusId: z.string().nullable().optional(),
})

const BulkUpdateSchema = z.object({
  configs: z.array(ConfigSchema),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const campusId = searchParams.get('campusId') || undefined
      const configs = await getApprovalConfigs(campusId)
      return NextResponse.json(ok(configs))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch approval configs'), { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const { configs } = BulkUpdateSchema.parse(body)
      const results = await bulkUpsertApprovalConfigs(orgId, configs)
      return NextResponse.json(ok(results))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update approval configs'), { status: 500 })
  }
}
