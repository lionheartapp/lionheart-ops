import { prisma } from '@/lib/db'

const db = prisma as any

const APPROVAL_CHANNELS = ['ADMIN', 'FACILITIES', 'AV_PRODUCTION', 'CUSTODIAL', 'SECURITY', 'ATHLETIC_DIRECTOR'] as const

export async function getApprovalConfigs(campusId?: string) {
  return db.approvalChannelConfig.findMany({
    where: { ...(campusId ? { campusId } : {}) },
    orderBy: { channelType: 'asc' },
  })
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
  return db.approvalChannelConfig.upsert({
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
