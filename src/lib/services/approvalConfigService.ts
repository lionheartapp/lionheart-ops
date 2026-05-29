import { prisma, type OrgPrismaClient } from '@/lib/db'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { getOrgContextId } from '@/lib/org-context'

const db = prisma as unknown as OrgPrismaClient

const APPROVAL_CHANNELS = ['ADMIN', 'FACILITIES', 'AV_PRODUCTION', 'CUSTODIAL', 'SECURITY'] as const

function invalidateApprovalConfigCache(): void {
  invalidateOrgCache(getOrgContextId(), 'approval-config')
}

export async function getApprovalConfigs(schoolId?: string) {
  const orgId = getOrgContextId()
  const bucket = `approval-config:list:school=${schoolId ?? 'all'}`
  return cacheOrgWide(orgId, bucket, () =>
    db.approvalChannelConfig.findMany({
      where: { ...(schoolId ? { schoolId } : {}) },
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
  schoolId?: string | null
  organizationId: string
}) {
  const schoolId = data.schoolId || null
  const configData = {
    mode: data.mode,
    assignedTeamId: data.assignedTeamId || null,
    escalationHours: data.escalationHours ?? 72,
    autoApproveIfNoResource: data.autoApproveIfNoResource ?? true,
  }

  if (!schoolId) {
    const existing = await db.approvalChannelConfig.findFirst({
      where: {
        organizationId: data.organizationId,
        schoolId: null,
        channelType: data.channelType,
      },
    })

    const result = existing
      ? await db.approvalChannelConfig.update({
          where: { id: existing.id },
          data: configData,
        })
      : await db.approvalChannelConfig.create({
          data: {
            channelType: data.channelType,
            organizationId: data.organizationId,
            schoolId: null,
            ...configData,
          },
        })

    invalidateApprovalConfigCache()
    return result
  }

  const result = await db.approvalChannelConfig.upsert({
    where: {
      organizationId_schoolId_channelType: {
        organizationId: data.organizationId,
        schoolId,
        channelType: data.channelType,
      },
    },
    create: {
      channelType: data.channelType,
      schoolId,
      organizationId: data.organizationId,
      ...configData,
    },
    update: configData,
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
    schoolId?: string | null
    campusId?: string | null
  }>
) {
  const results = []
  for (const config of configs) {
    const result = await upsertApprovalConfig({
      ...config,
      schoolId: config.schoolId ?? config.campusId ?? null,
      organizationId,
    })
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
