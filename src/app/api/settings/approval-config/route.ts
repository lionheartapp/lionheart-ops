import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getApprovalConfigs, bulkUpsertApprovalConfigs } from '@/lib/services/approvalConfigService'

const ConfigSchema = z.object({
  channelType: z.enum(['ADMIN', 'FACILITIES', 'AV_PRODUCTION', 'CUSTODIAL', 'SECURITY']),
  mode: z.enum(['REQUIRED', 'NOTIFICATION', 'DISABLED']),
  assignedTeamId: z.string().nullable().optional(),
  escalationHours: z.number().int().min(1).max(720).optional(),
  autoApproveIfNoResource: z.boolean().optional(),
  campusId: z.string().nullable().optional(),
})

const BulkUpdateSchema = z.object({
  configs: z.array(ConfigSchema),
})

export const GET = withAuth(async ({ searchParams }) => {
  const campusId = searchParams.get('campusId') || undefined
  const configs = await getApprovalConfigs(campusId)
  return NextResponse.json(ok(configs))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PUT = withAuth<z.infer<typeof BulkUpdateSchema>>(async ({ orgId, body }) => {
  const results = await bulkUpsertApprovalConfigs(orgId, body.configs)
  return NextResponse.json(ok(results))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: BulkUpdateSchema })
