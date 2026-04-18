/**
 * IT Analytics Service
 *
 * 10 aggregation query functions covering the full IT analytics dashboard:
 *   IT-ANALYTICS-01: Ticket volume by issue type
 *   IT-ANALYTICS-02: Average resolution time by campus + issue type
 *   IT-ANALYTICS-03: Password reset volume by month
 *   IT-ANALYTICS-04: Device health by campus
 *   IT-ANALYTICS-05: Lemon device report
 *   IT-ANALYTICS-06: Repair cost by model
 *   IT-ANALYTICS-07: Technician workload (active tickets)
 *   IT-ANALYTICS-08: SLA compliance by campus
 *   IT-ANALYTICS-09: Summer repair throughput
 *   IT-ANALYTICS-10: Loaner pool utilization
 *
 * All functions use rawPrisma (bypass org-scope) and apply
 * organizationId + deletedAt filters manually.
 */

import { rawPrisma } from '@/lib/db'
import { subMonths, startOfDay, format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ITAnalyticsOptions {
  schoolId?: string
  months?: number
}

// IT-ANALYTICS-01
export interface TicketVolumeByType {
  issueType: string
  count: number
}

// IT-ANALYTICS-02
export interface AvgResolutionTimeResult {
  campus: string
  issueType: string
  avgHours: number
}

// IT-ANALYTICS-03
export interface PasswordResetVolumeResult {
  month: string
  count: number
}

// IT-ANALYTICS-04
export interface DeviceHealthResult {
  schoolId: string
  schoolName: string
  good: number
  fair: number
  poor: number
  retired: number
}

// IT-ANALYTICS-05
export interface LemonDeviceResult {
  id: string
  assetTag: string
  model: string | null
  repairCount: number
  totalRepairCost: number
  aiRecommendation: unknown
}

// IT-ANALYTICS-06
export interface RepairCostByModelResult {
  model: string
  totalCost: number
  repairCount: number
  avgCostPerRepair: number
}

// IT-ANALYTICS-07
export interface ITTechWorkloadResult {
  technicianId: string
  name: string
  activeTickets: number
}

// IT-ANALYTICS-08
export interface SLAComplianceResult {
  campus: string
  total: number
  met: number
  breached: number
  compliancePct: number
}

// IT-ANALYTICS-09
export interface SummerThroughputResult {
  total: number
  completed: number
  completionPct: number
  repairCount: number
}

// IT-ANALYTICS-10
export interface LoanerUtilizationResult {
  totalLoaners: number
  activeCheckouts: number
  utilizationPct: number
}

// Combined
export interface AllITAnalyticsResult {
  ticketVolume: TicketVolumeByType[]
  resolutionTime: AvgResolutionTimeResult[]
  passwordResetVolume: PasswordResetVolumeResult[]
  deviceHealth: DeviceHealthResult[]
  lemonDevices: LemonDeviceResult[]
  repairCostByModel: RepairCostByModelResult[]
  technicianWorkload: ITTechWorkloadResult[]
  slaCompliance: SLAComplianceResult[]
  summerThroughput: SummerThroughputResult
  loanerUtilization: LoanerUtilizationResult
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** SLA thresholds in hours by priority level */
const SLA_THRESHOLDS: Record<string, number> = {
  URGENT: 4,
  HIGH: 8,
  MEDIUM: 24,
  LOW: 48,
}

function getCutoff(months: number): Date {
  return subMonths(startOfDay(new Date()), months)
}

// ─── IT-ANALYTICS-01: Ticket Volume by Issue Type ────────────────────────────

export async function getTicketVolumeByType(
  orgId: string,
  opts: ITAnalyticsOptions = {}
): Promise<TicketVolumeByType[]> {
  const { months = 6, schoolId } = opts
  const cutoff = getCutoff(months)

  const grouped = await rawPrisma.iTTicket.groupBy({
    by: ['issueType'],
    where: {
      organizationId: orgId,
      deletedAt: null,
      createdAt: { gte: cutoff },
      ...(schoolId ? { schoolId } : {}),
    },
    _count: { id: true },
  })

  return grouped
    .map((g) => ({
      issueType: g.issueType,
      count: g._count.id,
    }))
    .sort((a, b) => b.count - a.count)
}

// ─── IT-ANALYTICS-02: Average Resolution Time by Campus + Issue Type ─────────

export async function getAvgResolutionTime(
  orgId: string,
  opts: ITAnalyticsOptions = {}
): Promise<AvgResolutionTimeResult[]> {
  const { months = 6, schoolId } = opts
  const cutoff = getCutoff(months)

  const tickets = await rawPrisma.iTTicket.findMany({
    where: {
      organizationId: orgId,
      status: 'DONE',
      deletedAt: null,
      createdAt: { gte: cutoff },
      ...(schoolId ? { schoolId } : {}),
    },
    select: {
      issueType: true,
      schoolId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (tickets.length === 0) return []

  // Look up school names
  const schoolIds = [...new Set(tickets.map((t) => t.schoolId).filter(Boolean) as string[])]
  const schools = schoolIds.length > 0
    ? await rawPrisma.school.findMany({
        where: { id: { in: schoolIds }, deletedAt: null },
        select: { id: true, name: true },
      })
    : []
  const schoolMap = new Map(schools.map((s) => [s.id, s.name]))

  // Group by schoolId + issueType, compute average hours
  const groupMap: Map<string, { totalHours: number; count: number }> = new Map()

  for (const t of tickets) {
    const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / 3_600_000
    if (hours < 0) continue
    const campusName = t.schoolId ? (schoolMap.get(t.schoolId) ?? 'Unknown Campus') : 'No Campus'
    const key = `${campusName}|||${t.issueType}`
    const existing = groupMap.get(key)
    if (existing) {
      existing.totalHours += hours
      existing.count++
    } else {
      groupMap.set(key, { totalHours: hours, count: 1 })
    }
  }

  return [...groupMap.entries()]
    .map(([key, { totalHours, count }]) => {
      const [campus, issueType] = key.split('|||')
      return {
        campus,
        issueType,
        avgHours: Math.round((totalHours / count) * 10) / 10,
      }
    })
    .sort((a, b) => b.avgHours - a.avgHours)
}

// ─── IT-ANALYTICS-03: Password Reset Volume by Month ─────────────────────────

export async function getPasswordResetVolume(
  orgId: string,
  opts: ITAnalyticsOptions = {}
): Promise<PasswordResetVolumeResult[]> {
  const { months = 12, schoolId } = opts
  const cutoff = getCutoff(months)

  const tickets = await rawPrisma.iTTicket.findMany({
    where: {
      organizationId: orgId,
      issueType: 'ACCOUNT_PASSWORD',
      deletedAt: null,
      createdAt: { gte: cutoff },
      ...(schoolId ? { schoolId } : {}),
    },
    select: { createdAt: true },
  })

  // Group by month
  const monthMap: Map<string, number> = new Map()
  for (const t of tickets) {
    const month = format(t.createdAt, 'yyyy-MM')
    monthMap.set(month, (monthMap.get(month) ?? 0) + 1)
  }

  return [...monthMap.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

// ─── IT-ANALYTICS-04: Device Health by Campus ────────────────────────────────

export async function getDeviceHealthByCampus(
  orgId: string,
  opts: ITAnalyticsOptions = {}
): Promise<DeviceHealthResult[]> {
  const { schoolId } = opts

  const grouped = await rawPrisma.iTDevice.groupBy({
    by: ['schoolId', 'status'],
    where: {
      organizationId: orgId,
      deletedAt: null,
      ...(schoolId ? { schoolId } : {}),
    },
    _count: { id: true },
  })

  if (grouped.length === 0) return []

  // Look up school names
  const schoolIds = [...new Set(grouped.map((g) => g.schoolId).filter(Boolean) as string[])]
  const schools = schoolIds.length > 0
    ? await rawPrisma.school.findMany({
        where: { id: { in: schoolIds }, deletedAt: null },
        select: { id: true, name: true },
      })
    : []
  const schoolMap = new Map(schools.map((s) => [s.id, s.name]))

  // Map device statuses to health buckets
  // ACTIVE = good, NEEDS_REPAIR/IN_REPAIR = fair, DAMAGED/SURPLUS = poor, RETIRED/DECOMMISSIONED = retired
  const healthBucket = (status: string): 'good' | 'fair' | 'poor' | 'retired' => {
    switch (status) {
      case 'ACTIVE':
      case 'LOANER':
        return 'good'
      case 'NEEDS_REPAIR':
      case 'IN_REPAIR':
        return 'fair'
      case 'DAMAGED':
      case 'SURPLUS':
        return 'poor'
      case 'RETIRED':
      case 'DECOMMISSIONED':
        return 'retired'
      default:
        return 'good'
    }
  }

  // Accumulate by school
  const accum: Map<string, { schoolName: string; good: number; fair: number; poor: number; retired: number }> = new Map()

  for (const row of grouped) {
    const sid = row.schoolId ?? '__none__'
    const schoolName = row.schoolId ? (schoolMap.get(row.schoolId) ?? 'Unknown Campus') : 'Unassigned'

    if (!accum.has(sid)) {
      accum.set(sid, { schoolName, good: 0, fair: 0, poor: 0, retired: 0 })
    }
    const entry = accum.get(sid)!
    const bucket = healthBucket(row.status)
    entry[bucket] += row._count.id
  }

  return [...accum.entries()]
    .map(([sid, data]) => ({
      schoolId: sid,
      schoolName: data.schoolName,
      good: data.good,
      fair: data.fair,
      poor: data.poor,
      retired: data.retired,
    }))
    .sort((a, b) => a.schoolName.localeCompare(b.schoolName))
}

// ─── IT-ANALYTICS-05: Lemon Device Report ────────────────────────────────────

export async function getLemonDeviceReport(
  orgId: string,
  opts: ITAnalyticsOptions = {}
): Promise<LemonDeviceResult[]> {
  const { schoolId } = opts

  const devices = await rawPrisma.iTDevice.findMany({
    where: {
      organizationId: orgId,
      isLemon: true,
      deletedAt: null,
      ...(schoolId ? { schoolId } : {}),
    },
    select: {
      id: true,
      assetTag: true,
      model: true,
      aiRecommendation: true,
      repairs: {
        select: {
          repairCost: true,
        },
      },
    },
  })

  return devices
    .map((d) => ({
      id: d.id,
      assetTag: d.assetTag,
      model: d.model,
      repairCount: d.repairs.length,
      totalRepairCost: Math.round(d.repairs.reduce((sum, r) => sum + r.repairCost, 0) * 100) / 100,
      aiRecommendation: d.aiRecommendation,
    }))
    .sort((a, b) => b.totalRepairCost - a.totalRepairCost)
}

// ─── IT-ANALYTICS-06: Repair Cost by Model ───────────────────────────────────

export async function getRepairCostByModel(
  orgId: string,
  opts: ITAnalyticsOptions = {}
): Promise<RepairCostByModelResult[]> {
  const { schoolId } = opts

  const repairs = await rawPrisma.iTDeviceRepair.findMany({
    where: {
      organizationId: orgId,
      ...(schoolId ? { device: { schoolId, deletedAt: null } } : {}),
    },
    select: {
      repairCost: true,
      device: {
        select: { model: true },
      },
    },
  })

  // Group by model
  const modelMap: Map<string, { totalCost: number; count: number }> = new Map()

  for (const r of repairs) {
    const model = r.device.model ?? 'Unknown Model'
    const existing = modelMap.get(model)
    if (existing) {
      existing.totalCost += r.repairCost
      existing.count++
    } else {
      modelMap.set(model, { totalCost: r.repairCost, count: 1 })
    }
  }

  return [...modelMap.entries()]
    .map(([model, { totalCost, count }]) => ({
      model,
      totalCost: Math.round(totalCost * 100) / 100,
      repairCount: count,
      avgCostPerRepair: Math.round((totalCost / count) * 100) / 100,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
}

// ─── IT-ANALYTICS-07: Technician Workload ────────────────────────────────────

export async function getTechnicianWorkload(
  orgId: string,
  opts: ITAnalyticsOptions = {}
): Promise<ITTechWorkloadResult[]> {
  const { schoolId } = opts

  const ticketGroups = await rawPrisma.iTTicket.groupBy({
    by: ['assignedToId'],
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: { notIn: ['DONE', 'CANCELLED'] },
      assignedToId: { not: null },
      ...(schoolId ? { schoolId } : {}),
    },
    _count: { id: true },
  })

  if (ticketGroups.length === 0) return []

  // Look up user names
  const techIds = ticketGroups.map((g) => g.assignedToId!)
  const users = await rawPrisma.user.findMany({
    where: { id: { in: techIds }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))

  return techIds
    .map((id) => {
      const user = userMap.get(id)
      const group = ticketGroups.find((g) => g.assignedToId === id)
      return {
        technicianId: id,
        name: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : id,
        activeTickets: group?._count.id ?? 0,
      }
    })
    .sort((a, b) => b.activeTickets - a.activeTickets)
}

// ─── IT-ANALYTICS-08: SLA Compliance by Campus ──────────────────────────────

export async function getSLACompliance(
  orgId: string,
  opts: ITAnalyticsOptions = {}
): Promise<SLAComplianceResult[]> {
  const { months = 6, schoolId } = opts
  const cutoff = getCutoff(months)

  const tickets = await rawPrisma.iTTicket.findMany({
    where: {
      organizationId: orgId,
      status: 'DONE',
      deletedAt: null,
      createdAt: { gte: cutoff },
      ...(schoolId ? { schoolId } : {}),
    },
    select: {
      schoolId: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (tickets.length === 0) return []

  // Look up school names
  const schoolIds = [...new Set(tickets.map((t) => t.schoolId).filter(Boolean) as string[])]
  const schools = schoolIds.length > 0
    ? await rawPrisma.school.findMany({
        where: { id: { in: schoolIds }, deletedAt: null },
        select: { id: true, name: true },
      })
    : []
  const schoolMap = new Map(schools.map((s) => [s.id, s.name]))

  // Group by campus, check SLA compliance
  const campusAccum: Map<string, { campusName: string; total: number; met: number; breached: number }> = new Map()

  for (const t of tickets) {
    const campusKey = t.schoolId ?? '__none__'
    const campusName = t.schoolId ? (schoolMap.get(t.schoolId) ?? 'Unknown Campus') : 'No Campus'

    if (!campusAccum.has(campusKey)) {
      campusAccum.set(campusKey, { campusName, total: 0, met: 0, breached: 0 })
    }
    const entry = campusAccum.get(campusKey)!
    entry.total++

    const resolutionHours = (t.updatedAt.getTime() - t.createdAt.getTime()) / 3_600_000
    const threshold = SLA_THRESHOLDS[t.priority] ?? SLA_THRESHOLDS.MEDIUM

    if (resolutionHours <= threshold) {
      entry.met++
    } else {
      entry.breached++
    }
  }

  return [...campusAccum.entries()]
    .map(([, data]) => ({
      campus: data.campusName,
      total: data.total,
      met: data.met,
      breached: data.breached,
      compliancePct: data.total > 0 ? Math.round((data.met / data.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.compliancePct - a.compliancePct)
}

// ─── IT-ANALYTICS-09: Summer Repair Throughput ───────────────────────────────

export async function getSummerRepairThroughput(
  orgId: string,
  _opts: ITAnalyticsOptions = {}
): Promise<SummerThroughputResult> {
  const [totalCount, completedCount, repairCount] = await Promise.all([
    // Total summer batch items
    rawPrisma.iTSummerBatchItem.count({
      where: { organizationId: orgId },
    }),
    // Completed summer batch items
    rawPrisma.iTSummerBatchItem.count({
      where: { organizationId: orgId, completed: true },
    }),
    // Repairs performed on devices that are part of summer batches
    rawPrisma.iTDeviceRepair.count({
      where: {
        organizationId: orgId,
        device: {
          summerBatchItems: { some: { organizationId: orgId } },
        },
      },
    }),
  ])

  return {
    total: totalCount,
    completed: completedCount,
    completionPct: totalCount > 0 ? Math.round((completedCount / totalCount) * 1000) / 10 : 0,
    repairCount,
  }
}

// ─── IT-ANALYTICS-10: Loaner Pool Utilization ────────────────────────────────

export async function getLoanerPoolUtilization(
  orgId: string,
  _opts: ITAnalyticsOptions = {}
): Promise<LoanerUtilizationResult> {
  const [totalLoaners, activeCheckouts] = await Promise.all([
    // Count devices with LOANER status
    rawPrisma.iTDevice.count({
      where: {
        organizationId: orgId,
        status: 'LOANER',
        deletedAt: null,
      },
    }),
    // Count active checkouts (not yet checked in)
    rawPrisma.iTLoanerCheckout.count({
      where: {
        organizationId: orgId,
        checkedInAt: null,
      },
    }),
  ])

  return {
    totalLoaners,
    activeCheckouts,
    utilizationPct: totalLoaners > 0 ? Math.round((activeCheckouts / totalLoaners) * 1000) / 10 : 0,
  }
}

// ─── Combined: all 10 in parallel ────────────────────────────────────────────

export async function getAllITAnalytics(
  orgId: string,
  opts: ITAnalyticsOptions = {}
): Promise<AllITAnalyticsResult> {
  const [
    ticketVolume,
    resolutionTime,
    passwordResetVolume,
    deviceHealth,
    lemonDevices,
    repairCostByModel,
    technicianWorkload,
    slaCompliance,
    summerThroughput,
    loanerUtilization,
  ] = await Promise.all([
    getTicketVolumeByType(orgId, opts),
    getAvgResolutionTime(orgId, opts),
    getPasswordResetVolume(orgId, opts),
    getDeviceHealthByCampus(orgId, opts),
    getLemonDeviceReport(orgId, opts),
    getRepairCostByModel(orgId, opts),
    getTechnicianWorkload(orgId, opts),
    getSLACompliance(orgId, opts),
    getSummerRepairThroughput(orgId, opts),
    getLoanerPoolUtilization(orgId, opts),
  ])

  return {
    ticketVolume,
    resolutionTime,
    passwordResetVolume,
    deviceHealth,
    lemonDevices,
    repairCostByModel,
    technicianWorkload,
    slaCompliance,
    summerThroughput,
    loanerUtilization,
  }
}
