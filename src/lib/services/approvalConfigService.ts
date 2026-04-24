import { prisma, type OrgPrismaClient } from '@/lib/db'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { getOrgContextId } from '@/lib/org-context'

const db = prisma as unknown as OrgPrismaClient

const APPROVAL_CHANNELS = ['ADMIN', 'FACILITIES', 'AV_PRODUCTION', 'CUSTODIAL', 'SECURITY', 'ATHLETIC_DIRECTOR'] as const

function invalidateApprovalConfigCache(): void {
  invalidateOrgCache(getOrgContextId(), 'approval-config')
}

export async function getApprovalConfigs(campusId?: string) {
  const orgId = getOrgContextId()
  const bucket = `approval-config:list:campus=${campusId ?? 'all'}`
  return cacheOrgWide(orgId, bucket, () =>
    db.approvalChannelConfig.findMany({
      where: { ...(campusId ? { campusId } : {}) },
      orderBy: { channelType: 'asc' },
    })
  )
}

export async function upsertApprovalConfig(data: {
  channelType: string
  mode: string
  assignedTeamId?: string | null
  escalationHours?: number
  autoApproveIfNoResource?: boolean
  campusId?: string | null
  organizationId: string
}) {
  const result = await db.approvalChannelConfig.upsert({
    where: {
      organizationId_campusId_channelType: {
        organizationId: data.organizationId,
        campusId: data.campusId || null,
        channelType: data.channelType,
      },
    },
    create: {
      channelType: data.channelType,
      mode: data.mode,
      assignedTeamId: data.assignedTeamId || null,
      escalationHours: data.escalationHours ?? 72,
      autoApproveIfNoResource: data.autoApproveIfNoResource ?? true,
      campusId: data.campusId || null,
    },
    update: {
      mode: data.mode,
      assignedTeamId: data.assignedTeamId || null,
      escalationHours: data.escalationHours ?? 72,
      autoApproveIfNoResource: data.autoApproveIfNoResource ?? true,
    },
  })
  invalidateApprovalConfigCache()
  return result
}

export async function bulkUpsertApprovalConfigs(
  organizationId: string,
  configs: Array<{
    channelType: string
    mode: string
    assignedTeamId?: string | null
    escalationHours?: number
    autoApproveIfNoResource?: boolean
    campusId?: string | null
  }>
) {
  const results = []
  for (const config of configs) {
    const result = await upsertApprovalConfig({ ...config, organizationId })
    results.push(result)
  }
  return results
}

export async function seedDefaultApprovalConfigs(organizationId: string) {
  const existing = await db.approvalChannelConfig.findMany({
    where: { organizationId },
  })
  if (existing.length > 0) return existing

  const defaults = APPROVAL_CHANNELS.map((channelType) => ({
    channelType,
    mode: channelType === 'ADMIN' ? 'REQUIRED' : 'NOTIFICATION',
    organizationId,
  }))

  return bulkUpsertApprovalConfigs(organizationId, defaults)
}
