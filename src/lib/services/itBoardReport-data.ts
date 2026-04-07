/**
 * IT Board Report Service — Data Aggregation
 *
 * Database queries and metric calculations for annual tech reports,
 * refresh forecasting, repair/replace analysis, and damage fee collection.
 */

import { rawPrisma } from '@/lib/db'
import type {
  AnnualTechReportMetrics,
  RefreshForecastMetrics,
  RepairReplaceMetrics,
  DamageFeeCollectionMetrics,
} from './itBoardReport-types'

// ─── 1. Annual Tech Report ──────────────────────────────────────────────────

export async function getAnnualTechReport(
  orgId: string,
  filters: { from: Date; to: Date; schoolId?: string }
): Promise<AnnualTechReportMetrics> {
  const { from, to, schoolId } = filters

  // YoY date range (shift back 1 year)
  const yoyFrom = new Date(from)
  yoyFrom.setFullYear(yoyFrom.getFullYear() - 1)
  const yoyTo = new Date(to)
  yoyTo.setFullYear(yoyTo.getFullYear() - 1)

  const deviceWhere: Record<string, unknown> = {
    organizationId: orgId,
    deletedAt: null,
  }
  if (schoolId) deviceWhere.schoolId = schoolId

  const ticketWhere: Record<string, unknown> = {
    organizationId: orgId,
    createdAt: { gte: from, lte: to },
    deletedAt: null,
  }
  if (schoolId) ticketWhere.schoolId = schoolId

  const yoyTicketWhere: Record<string, unknown> = {
    organizationId: orgId,
    createdAt: { gte: yoyFrom, lte: yoyTo },
    deletedAt: null,
  }
  if (schoolId) yoyTicketWhere.schoolId = schoolId

  const [
    allDevices,
    repairs,
    tickets,
    yoyTickets,
    yoyDevices,
    yoyRepairs,
    orgInfo,
    itStaffCount,
  ] = await Promise.all([
    // All devices
    rawPrisma.iTDevice.findMany({
      where: deviceWhere,
      select: {
        id: true,
        status: true,
        purchaseDate: true,
        purchasePrice: true,
        model: true,
      },
    }),

    // Repairs in the period
    rawPrisma.iTDeviceRepair.findMany({
      where: {
        organizationId: orgId,
        repairDate: { gte: from, lte: to },
        ...(schoolId ? { device: { schoolId } } : {}),
      },
      select: {
        id: true,
        deviceId: true,
        repairCost: true,
      },
    }),

    // IT tickets in the period
    rawPrisma.iTTicket.findMany({
      where: ticketWhere,
      select: {
        id: true,
        issueType: true,
      },
    }),

    // YoY tickets
    rawPrisma.iTTicket.findMany({
      where: yoyTicketWhere,
      select: { id: true },
    }),

    // YoY device count (snapshot at yoyTo — use all devices that existed before yoyTo)
    rawPrisma.iTDevice.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        createdAt: { lte: yoyTo },
        ...(schoolId ? { schoolId } : {}),
      },
      select: { id: true },
    }),

    // YoY repairs
    rawPrisma.iTDeviceRepair.findMany({
      where: {
        organizationId: orgId,
        repairDate: { gte: yoyFrom, lte: yoyTo },
        ...(schoolId ? { device: { schoolId } } : {}),
      },
      select: { repairCost: true },
    }),

    // Org info for cost per student and staff count
    rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: { studentCount: true, staffCount: true },
    }),

    // IT staff (users on "IT Support" team)
    rawPrisma.userTeam.count({
      where: {
        team: {
          organizationId: orgId,
          name: { contains: 'IT', mode: 'insensitive' },
        },
      },
    }),
  ])

  const now = new Date()
  const totalDevices = allDevices.length
  const activeDevices = allDevices.filter((d) => d.status === 'ACTIVE').length

  // Cost per student: total repair cost / student count
  const totalRepairCost = repairs.reduce((sum, r) => sum + r.repairCost, 0)
  const studentCount = orgInfo?.studentCount
  const costPerStudent =
    studentCount && studentCount > 0 ? totalRepairCost / studentCount : null

  // Repair rate: % of devices that had at least one repair
  const devicesWithRepairs = new Set(repairs.map((r) => r.deviceId))
  const repairRate =
    totalDevices > 0
      ? Math.round((devicesWithRepairs.size / totalDevices) * 100)
      : 0

  // Fleet age distribution
  const ageRanges = [
    { range: '<1 year', min: 0, max: 1 },
    { range: '1-2 years', min: 1, max: 2 },
    { range: '2-3 years', min: 2, max: 3 },
    { range: '3-4 years', min: 3, max: 4 },
    { range: '>4 years', min: 4, max: Infinity },
  ]

  const fleetAgeDistribution = ageRanges.map(({ range, min, max }) => {
    const count = allDevices.filter((d) => {
      if (!d.purchaseDate) return range === '>4 years' // Unknown age defaults to oldest bucket
      const ageYears =
        (now.getTime() - d.purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      return ageYears >= min && ageYears < max
    }).length
    return { range, count }
  })

  // YoY comparison
  const yoyTotalRepairCost = yoyRepairs.reduce((sum, r) => sum + r.repairCost, 0)

  const yoyComparison = {
    thisYear: {
      ticketCount: tickets.length,
      deviceCount: totalDevices,
      totalRepairCost,
    },
    lastYear: {
      ticketCount: yoyTickets.length,
      deviceCount: yoyDevices.length,
      totalRepairCost: yoyTotalRepairCost,
    },
  }

  // IT staff to student ratio
  const itStaffToStudentRatio =
    itStaffCount > 0 && studentCount && studentCount > 0
      ? `1:${Math.round(studentCount / itStaffCount)}`
      : null

  // Top issue types
  const issueTypeCounts: Record<string, number> = {}
  for (const ticket of tickets) {
    const type = ticket.issueType
    issueTypeCounts[type] = (issueTypeCounts[type] ?? 0) + 1
  }
  const topIssueTypes = Object.entries(issueTypeCounts)
    .map(([issueType, count]) => ({ issueType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    period: { from, to },
    totalDevices,
    activeDevices,
    costPerStudent,
    repairRate,
    fleetAgeDistribution,
    yoyComparison,
    itStaffToStudentRatio,
    topIssueTypes,
  }
}

// ─── 2. Refresh Forecast ────────────────────────────────────────────────────

export async function getRefreshForecast(
  orgId: string,
  options: { thresholdYears?: number } = {}
): Promise<RefreshForecastMetrics> {
  const thresholdYears = options.thresholdYears ?? 4

  const devices = await rawPrisma.iTDevice.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: { in: ['ACTIVE', 'REPAIR', 'LOANER'] },
      purchaseDate: { not: null },
    },
    select: {
      id: true,
      model: true,
      purchaseDate: true,
      purchasePrice: true,
    },
  })

  const now = new Date()
  const in1Year = new Date(now)
  in1Year.setFullYear(in1Year.getFullYear() + 1)
  const in2Years = new Date(now)
  in2Years.setFullYear(in2Years.getFullYear() + 2)
  const in3Years = new Date(now)
  in3Years.setFullYear(in3Years.getFullYear() + 3)

  // Calculate average purchase price for devices without a price
  const devicesWithPrice = devices.filter((d) => d.purchasePrice != null && d.purchasePrice > 0)
  const avgPrice =
    devicesWithPrice.length > 0
      ? devicesWithPrice.reduce((sum, d) => sum + (d.purchasePrice ?? 0), 0) / devicesWithPrice.length
      : 350 // Fallback average Chromebook cost

  type BucketDevice = {
    model: string
    estCost: number
  }

  const bucket1: BucketDevice[] = []
  const bucket2: BucketDevice[] = []
  const bucket3: BucketDevice[] = []

  for (const device of devices) {
    if (!device.purchaseDate) continue

    const eolDate = new Date(device.purchaseDate)
    eolDate.setFullYear(eolDate.getFullYear() + thresholdYears)

    // Already past EOL or due within 1 year
    if (eolDate <= in1Year) {
      bucket1.push({
        model: device.model ?? 'Unknown',
        estCost: device.purchasePrice ?? avgPrice,
      })
    } else if (eolDate <= in2Years) {
      bucket2.push({
        model: device.model ?? 'Unknown',
        estCost: device.purchasePrice ?? avgPrice,
      })
    } else if (eolDate <= in3Years) {
      bucket3.push({
        model: device.model ?? 'Unknown',
        estCost: device.purchasePrice ?? avgPrice,
      })
    }
  }

  const groupByModel = (bucket: BucketDevice[]) => {
    const grouped: Record<string, { count: number; totalCost: number }> = {}
    for (const d of bucket) {
      if (!grouped[d.model]) grouped[d.model] = { count: 0, totalCost: 0 }
      grouped[d.model].count++
      grouped[d.model].totalCost += d.estCost
    }
    return Object.entries(grouped)
      .map(([model, { count, totalCost }]) => ({
        model,
        count,
        estCost: Math.round(totalCost),
      }))
      .sort((a, b) => b.count - a.count)
  }

  const b1Cost = Math.round(bucket1.reduce((sum, d) => sum + d.estCost, 0))
  const b2Cost = Math.round(bucket2.reduce((sum, d) => sum + d.estCost, 0))
  const b3Cost = Math.round(bucket3.reduce((sum, d) => sum + d.estCost, 0))

  return {
    thresholdYears,
    devicesDueIn1Year: {
      count: bucket1.length,
      projectedCost: b1Cost,
      models: groupByModel(bucket1),
    },
    devicesDueIn2Years: {
      count: bucket2.length,
      projectedCost: b2Cost,
      models: groupByModel(bucket2),
    },
    devicesDueIn3Years: {
      count: bucket3.length,
      projectedCost: b3Cost,
      models: groupByModel(bucket3),
    },
    staggeredBudget: {
      year1: b1Cost,
      year2: b2Cost,
      year3: b3Cost,
    },
  }
}

// ─── 3. Repair vs Replace Summary ──────────────────────────────────────────

export async function getRepairReplaceSummary(
  orgId: string
): Promise<RepairReplaceMetrics> {
  // Fetch devices flagged as lemons or with significant repair history
  const devices = await rawPrisma.iTDevice.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: { in: ['ACTIVE', 'REPAIR', 'LOANER'] },
    },
    select: {
      id: true,
      assetTag: true,
      model: true,
      purchasePrice: true,
      isLemon: true,
      repairs: {
        select: {
          repairCost: true,
        },
      },
    },
  })

  // Calculate average purchase price for replacement cost estimate
  const devicesWithPrice = devices.filter((d) => d.purchasePrice != null && d.purchasePrice > 0)
  const avgPrice =
    devicesWithPrice.length > 0
      ? devicesWithPrice.reduce((sum, d) => sum + (d.purchasePrice ?? 0), 0) / devicesWithPrice.length
      : 350

  const REPLACE_THRESHOLD = 0.60 // Replace if repair cost > 60% of replacement

  const lemonDevices: RepairReplaceMetrics['lemonDevices'] = []

  for (const device of devices) {
    const cumulativeRepairCost = device.repairs.reduce(
      (sum, r) => sum + r.repairCost,
      0
    )

    // Only include devices with repair history or flagged as lemons
    if (cumulativeRepairCost === 0 && !device.isLemon) continue

    const estimatedReplacementCost = device.purchasePrice ?? avgPrice
    const repairRatio =
      estimatedReplacementCost > 0
        ? cumulativeRepairCost / estimatedReplacementCost
        : 0

    const recommendation: 'repair' | 'replace' =
      repairRatio >= REPLACE_THRESHOLD ? 'replace' : 'repair'

    const netSavings =
      recommendation === 'replace'
        ? cumulativeRepairCost - estimatedReplacementCost
        : 0

    lemonDevices.push({
      id: device.id,
      assetTag: device.assetTag,
      model: device.model,
      cumulativeRepairCost: Math.round(cumulativeRepairCost * 100) / 100,
      estimatedReplacementCost: Math.round(estimatedReplacementCost * 100) / 100,
      recommendation,
      netSavings: Math.round(netSavings * 100) / 100,
    })
  }

  // Sort by cumulative repair cost descending
  lemonDevices.sort((a, b) => b.cumulativeRepairCost - a.cumulativeRepairCost)

  const replaceDevices = lemonDevices.filter((d) => d.recommendation === 'replace')
  const totalRepairCost = replaceDevices.reduce(
    (sum, d) => sum + d.cumulativeRepairCost,
    0
  )
  const totalReplacementCost = replaceDevices.reduce(
    (sum, d) => sum + d.estimatedReplacementCost,
    0
  )

  return {
    lemonDevices,
    totalRepairCost: Math.round(totalRepairCost * 100) / 100,
    totalReplacementCost: Math.round(totalReplacementCost * 100) / 100,
    netSavings: Math.round((totalRepairCost - totalReplacementCost) * 100) / 100,
  }
}

// ─── 4. Damage Fee Collection ───────────────────────────────────────────────

export async function getDamageFeeCollection(
  orgId: string,
  filters: { schoolId?: string } = {}
): Promise<DamageFeeCollectionMetrics> {
  const { schoolId } = filters

  const batchItemWhere: Record<string, unknown> = {
    organizationId: orgId,
    condition: { not: null },
    damageFee: { not: null, gt: 0 },
  }
  if (schoolId) {
    batchItemWhere.batch = { schoolId }
  }

  const items = await rawPrisma.iTDeploymentBatchItem.findMany({
    where: batchItemWhere,
    select: {
      id: true,
      condition: true,
      damageFee: true,
      feeStatus: true,
      feePaidAt: true,
      feePaidAmount: true,
      createdAt: true,
      batch: {
        select: {
          schoolId: true,
          school: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  const now = new Date()

  let totalAssessed = 0
  let totalPaid = 0
  let totalOutstanding = 0
  let totalWaived = 0

  const conditionMap: Record<string, { count: number; totalFee: number }> = {}
  const agingMap: Record<string, { count: number; amount: number }> = {
    Current: { count: 0, amount: 0 },
    '30-day': { count: 0, amount: 0 },
    '60-day': { count: 0, amount: 0 },
    '90-day+': { count: 0, amount: 0 },
  }
  const schoolMap: Record<
    string,
    { schoolName: string; assessed: number; paid: number; outstanding: number }
  > = {}

  for (const item of items) {
    const fee = item.damageFee ?? 0
    const status = item.feeStatus ?? 'PENDING'
    const condition = item.condition as string

    totalAssessed += fee

    if (status === 'PAID') {
      totalPaid += item.feePaidAmount ?? fee
    } else if (status === 'WAIVED') {
      totalWaived += fee
    } else {
      // PENDING
      totalOutstanding += fee
    }

    // By condition
    if (!conditionMap[condition]) {
      conditionMap[condition] = { count: 0, totalFee: 0 }
    }
    conditionMap[condition].count++
    conditionMap[condition].totalFee += fee

    // Aging buckets (based on createdAt for outstanding items)
    if (status === 'PENDING') {
      const daysSince = Math.floor(
        (now.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      let bucket: string
      if (daysSince <= 30) bucket = 'Current'
      else if (daysSince <= 60) bucket = '30-day'
      else if (daysSince <= 90) bucket = '60-day'
      else bucket = '90-day+'

      agingMap[bucket].count++
      agingMap[bucket].amount += fee
    }

    // By school
    const sid = item.batch?.schoolId ?? 'unassigned'
    const sname = item.batch?.school?.name ?? 'Unassigned'
    if (!schoolMap[sid]) {
      schoolMap[sid] = { schoolName: sname, assessed: 0, paid: 0, outstanding: 0 }
    }
    schoolMap[sid].assessed += fee
    if (status === 'PAID') {
      schoolMap[sid].paid += item.feePaidAmount ?? fee
    } else if (status === 'PENDING') {
      schoolMap[sid].outstanding += fee
    }
  }

  const byCondition = Object.entries(conditionMap)
    .map(([condition, data]) => ({
      condition,
      count: data.count,
      totalFee: Math.round(data.totalFee * 100) / 100,
    }))
    .sort((a, b) => b.totalFee - a.totalFee)

  const agingBuckets = ['Current', '30-day', '60-day', '90-day+'].map((bucket) => ({
    bucket,
    count: agingMap[bucket].count,
    amount: Math.round(agingMap[bucket].amount * 100) / 100,
  }))

  const bySchool = Object.entries(schoolMap)
    .map(([schoolId, data]) => ({
      schoolId,
      schoolName: data.schoolName,
      assessed: Math.round(data.assessed * 100) / 100,
      paid: Math.round(data.paid * 100) / 100,
      outstanding: Math.round(data.outstanding * 100) / 100,
    }))
    .sort((a, b) => b.assessed - a.assessed)

  return {
    totalAssessed: Math.round(totalAssessed * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalWaived: Math.round(totalWaived * 100) / 100,
    byCondition,
    agingBuckets,
    bySchool,
  }
}
