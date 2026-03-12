/**
 * IT Board Report Service
 *
 * Aggregates IT device fleet metrics, refresh forecasting, repair/replace analysis,
 * and damage fee collection for superintendent-ready board reports. Also handles
 * AI narrative generation via Gemini and PDF export via jsPDF.
 *
 * Uses rawPrisma for all queries — org ID is passed explicitly.
 */

import { rawPrisma } from '@/lib/db'
import { jsPDF } from 'jspdf'
import { GoogleGenAI } from '@google/genai'
import { formatInTimezone, getOrgTimezone } from '@/lib/utils/timezone'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnnualTechReportMetrics {
  period: { from: Date; to: Date }
  totalDevices: number
  activeDevices: number
  costPerStudent: number | null
  repairRate: number // % of devices that had repairs
  fleetAgeDistribution: { range: string; count: number }[] // <1yr, 1-2yr, 2-3yr, 3-4yr, >4yr
  yoyComparison: {
    thisYear: { ticketCount: number; deviceCount: number; totalRepairCost: number }
    lastYear: { ticketCount: number; deviceCount: number; totalRepairCost: number }
  }
  itStaffToStudentRatio: string | null
  topIssueTypes: { issueType: string; count: number }[]
}

export interface RefreshForecastMetrics {
  thresholdYears: number
  devicesDueIn1Year: { count: number; projectedCost: number; models: { model: string; count: number; estCost: number }[] }
  devicesDueIn2Years: { count: number; projectedCost: number; models: { model: string; count: number; estCost: number }[] }
  devicesDueIn3Years: { count: number; projectedCost: number; models: { model: string; count: number; estCost: number }[] }
  staggeredBudget: { year1: number; year2: number; year3: number }
}

export interface RepairReplaceMetrics {
  lemonDevices: {
    id: string; assetTag: string; model: string | null
    cumulativeRepairCost: number; estimatedReplacementCost: number
    recommendation: 'repair' | 'replace'
    netSavings: number
  }[]
  totalRepairCost: number
  totalReplacementCost: number
  netSavings: number
}

export interface DamageFeeCollectionMetrics {
  totalAssessed: number
  totalPaid: number
  totalOutstanding: number
  totalWaived: number
  byCondition: { condition: string; count: number; totalFee: number }[]
  agingBuckets: { bucket: string; count: number; amount: number }[] // Current, 30-day, 60-day, 90-day+
  bySchool: { schoolId: string; schoolName: string; assessed: number; paid: number; outstanding: number }[]
}

export type ITReportType = 'annual' | 'refresh-forecast' | 'repair-replace' | 'damage-fees'

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

// ─── 5. AI Narrative Generation ─────────────────────────────────────────────

export async function generateITNarrative(
  metrics: Record<string, unknown>,
  orgName: string,
  reportType?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

  const reportLabel = reportType
    ? { annual: 'Annual Technology', 'refresh-forecast': 'Device Refresh Forecast', 'repair-replace': 'Repair vs Replace', 'damage-fees': 'Damage Fee Collection' }[reportType] ?? 'Technology'
    : 'Technology'

  const prompt = `You are writing an executive narrative summary for a K-12 school board ${reportLabel} report for ${orgName}. Be professional, concise (3-4 paragraphs), and highlight key findings and recommendations. The tone should be informative but accessible to non-technical board members.

Technology Metrics Data:
${JSON.stringify(metrics, null, 2)}

Write a 3-4 paragraph executive narrative that:
1. Summarizes the overall health of the technology fleet and IT operations
2. Highlights any areas of concern (high repair rates, aging devices, outstanding damage fees)
3. Provides actionable recommendations for the board (budget considerations, refresh planning, policy changes)
4. Uses specific numbers from the data to support key points

Do not use markdown formatting. Write in plain prose paragraphs.`

  if (!apiKey) {
    return buildFallbackNarrative(metrics, orgName)
  }

  try {
    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })
    return response.text ?? buildFallbackNarrative(metrics, orgName)
  } catch (err) {
    console.error('[itBoardReportService] AI narrative generation failed:', err)
    return buildFallbackNarrative(metrics, orgName)
  }
}

function buildFallbackNarrative(
  metrics: Record<string, unknown>,
  orgName: string
): string {
  // Attempt to extract meaningful data from the metrics object
  const totalDevices = (metrics.totalDevices as number) ?? 0
  const activeDevices = (metrics.activeDevices as number) ?? 0
  const repairRate = (metrics.repairRate as number) ?? 0
  const costPerStudent = metrics.costPerStudent as number | null
  const itStaffToStudentRatio = (metrics.itStaffToStudentRatio as string) ?? 'N/A'

  const yoy = metrics.yoyComparison as {
    thisYear?: { ticketCount?: number; totalRepairCost?: number }
    lastYear?: { ticketCount?: number; totalRepairCost?: number }
  } | undefined

  const thisYearTickets = yoy?.thisYear?.ticketCount ?? 0
  const lastYearTickets = yoy?.lastYear?.ticketCount ?? 0
  const thisYearCost = yoy?.thisYear?.totalRepairCost ?? 0

  // Refresh forecast data
  const thresholdYears = (metrics.thresholdYears as number) ?? 4
  const dueIn1 = metrics.devicesDueIn1Year as { count?: number; projectedCost?: number } | undefined
  const staggered = metrics.staggeredBudget as { year1?: number; year2?: number; year3?: number } | undefined

  // Damage fee data
  const totalAssessed = (metrics.totalAssessed as number) ?? 0
  const totalOutstanding = (metrics.totalOutstanding as number) ?? 0

  // Repair/replace data
  const lemonDevices = (metrics.lemonDevices as Array<unknown>) ?? []
  const netSavings = (metrics.netSavings as number) ?? 0

  return `Executive Summary — ${orgName} Technology Report

This report provides an overview of the technology fleet and IT operations for ${orgName}. The organization currently manages ${totalDevices} devices, of which ${activeDevices} are actively deployed. ${repairRate > 0 ? `The fleet-wide repair rate stands at ${repairRate}%, ` : ''}${costPerStudent != null ? `with a technology cost per student of $${costPerStudent.toFixed(2)}` : 'cost-per-student data is not yet available'}. The IT staff-to-student ratio is ${itStaffToStudentRatio}.

${thisYearTickets > 0 || lastYearTickets > 0 ? `Year-over-year, IT ticket volume has ${thisYearTickets > lastYearTickets ? 'increased' : 'decreased'} from ${lastYearTickets} to ${thisYearTickets} work orders, with total repair expenditures of $${Math.round(thisYearCost).toLocaleString()} during the current period.` : 'Ticket volume data will be populated as the system gathers historical information.'} ${dueIn1 ? `Looking ahead, ${dueIn1.count ?? 0} devices are approaching end-of-life within the next year, with a projected replacement cost of $${Math.round(dueIn1.projectedCost ?? 0).toLocaleString()}.` : ''} ${staggered ? `A staggered budget approach would allocate $${Math.round(staggered.year1 ?? 0).toLocaleString()} in year one, $${Math.round(staggered.year2 ?? 0).toLocaleString()} in year two, and $${Math.round(staggered.year3 ?? 0).toLocaleString()} in year three.` : ''}

${lemonDevices.length > 0 ? `The repair-vs-replace analysis has identified ${lemonDevices.length} devices where cumulative repair costs warrant replacement consideration, with potential net savings of $${Math.round(Math.abs(netSavings)).toLocaleString()}.` : ''} ${totalAssessed > 0 ? `Damage fee assessments total $${Math.round(totalAssessed).toLocaleString()}, with $${Math.round(totalOutstanding).toLocaleString()} outstanding.` : ''} The board should consider these findings when planning the upcoming technology budget cycle to ensure continued operational excellence and fiscal responsibility in managing the district's technology infrastructure.`
}

// ─── 6. PDF Export ──────────────────────────────────────────────────────────

export async function exportITReportPDF(
  reportType: ITReportType,
  metrics: Record<string, unknown>,
  narrative: string,
  orgName: string,
  orgTimezone: string = 'America/Chicago'
): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = 210
  const pageH = 297
  const marginL = 20
  const marginR = 20
  const contentW = pageW - marginL - marginR

  // Blue accent colors (#3B82F6 blue-500)
  const accentColor: [number, number, number] = [59, 130, 246]
  const accentLight: [number, number, number] = [239, 246, 255] // blue-50
  const accentBorder: [number, number, number] = [147, 197, 253] // blue-300

  const reportTitles: Record<ITReportType, string> = {
    annual: 'Annual Technology Report',
    'refresh-forecast': 'Device Refresh Forecast',
    'repair-replace': 'Repair vs Replace Analysis',
    'damage-fees': 'Damage Fee Collection Report',
  }

  const reportTitle = reportTitles[reportType]
  const generatedStr = `Generated: ${formatInTimezone(new Date(), orgTimezone, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`

  let totalPages = 3 // Cover + Executive Summary + Data pages vary by type

  if (reportType === 'annual') totalPages = 5
  else if (reportType === 'refresh-forecast') totalPages = 4
  else if (reportType === 'repair-replace') totalPages = 4
  else if (reportType === 'damage-fees') totalPages = 4

  const addFooter = (pageNum: number) => {
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'normal')
    doc.text(`${orgName} — Lionheart IT Management`, marginL, pageH - 8)
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - marginR, pageH - 8, {
      align: 'right',
    })
    doc.setDrawColor(220, 220, 220)
    doc.line(marginL, pageH - 12, pageW - marginR, pageH - 12)
  }

  // ── Page 1: Cover ──────────────────────────────────────────────────────────
  doc.setFillColor(...accentColor)
  doc.rect(0, 0, pageW, 60, 'F')

  doc.setFontSize(9)
  doc.setTextColor(191, 219, 254) // blue-200
  doc.setFont('helvetica', 'bold')
  doc.text('LIONHEART IT MANAGEMENT', marginL, 20)

  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text(reportTitle, marginL, 35)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text(orgName, marginL, 46)

  doc.setFontSize(10)
  doc.text(generatedStr, marginL, 54)

  // Cover stats box — varies by report type
  renderCoverStats(doc, reportType, metrics, marginL, contentW, pageW, marginR, accentColor, accentLight, accentBorder)

  addFooter(1)

  // ── Page 2: Executive Summary ─────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Executive Summary', marginL, 14)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(55, 65, 81)
  const narrativeLines = doc.splitTextToSize(narrative, contentW)
  doc.text(narrativeLines, marginL, 32)

  addFooter(2)

  // ── Data Pages (vary by report type) ──────────────────────────────────────
  if (reportType === 'annual') {
    renderAnnualDataPages(doc, metrics as unknown as AnnualTechReportMetrics, marginL, contentW, pageW, marginR, accentColor, accentLight, accentBorder, addFooter)
  } else if (reportType === 'refresh-forecast') {
    renderRefreshDataPages(doc, metrics as unknown as RefreshForecastMetrics, marginL, contentW, pageW, marginR, accentColor, accentLight, accentBorder, addFooter)
  } else if (reportType === 'repair-replace') {
    renderRepairReplaceDataPages(doc, metrics as unknown as RepairReplaceMetrics, marginL, contentW, pageW, marginR, accentColor, accentLight, accentBorder, addFooter)
  } else if (reportType === 'damage-fees') {
    renderDamageFeesDataPages(doc, metrics as unknown as DamageFeeCollectionMetrics, marginL, contentW, pageW, marginR, accentColor, accentLight, accentBorder, addFooter)
  }

  return doc.output('arraybuffer')
}

// ─── PDF Helpers ────────────────────────────────────────────────────────────

function renderCoverStats(
  doc: jsPDF,
  reportType: ITReportType,
  metrics: Record<string, unknown>,
  marginL: number,
  contentW: number,
  pageW: number,
  marginR: number,
  accentColor: [number, number, number],
  accentLight: [number, number, number],
  _accentBorder: [number, number, number]
) {
  if (reportType === 'annual') {
    const m = metrics as unknown as AnnualTechReportMetrics
    // Hero stat box
    doc.setFillColor(...accentColor)
    doc.roundedRect(marginL, 75, 80, 50, 4, 4, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL DEVICES', marginL + 8, 86)
    doc.setFontSize(36)
    doc.text(String(m.totalDevices ?? 0), marginL + 8, 108)
    doc.setFontSize(12)
    doc.text(`${m.activeDevices ?? 0} active`, marginL + 8, 118)

    // Side stats
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(marginL + 88, 75, contentW - 88, 50, 4, 4, 'F')
    const stats = [
      ['Repair Rate', `${m.repairRate ?? 0}%`],
      ['Cost Per Student', m.costPerStudent != null ? `$${m.costPerStudent.toFixed(2)}` : 'N/A'],
      ['IT Staff Ratio', m.itStaffToStudentRatio ?? 'N/A'],
      ['Top Issue', m.topIssueTypes?.[0]?.issueType ?? 'N/A'],
    ]
    stats.forEach(([label, value], i) => {
      const y = 87 + i * 11
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(107, 114, 128)
      doc.setFontSize(9)
      doc.text(label, marginL + 92, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text(value, pageW - marginR, y, { align: 'right' })
    })
  } else if (reportType === 'refresh-forecast') {
    const m = metrics as unknown as RefreshForecastMetrics
    doc.setFillColor(...accentLight)
    doc.roundedRect(marginL, 75, contentW, 40, 4, 4, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(`Refresh Threshold: ${m.thresholdYears} years`, marginL + 8, 87)

    const forecastStats = [
      [`Year 1: ${m.devicesDueIn1Year?.count ?? 0} devices`, `$${Math.round(m.devicesDueIn1Year?.projectedCost ?? 0).toLocaleString()}`],
      [`Year 2: ${m.devicesDueIn2Years?.count ?? 0} devices`, `$${Math.round(m.devicesDueIn2Years?.projectedCost ?? 0).toLocaleString()}`],
      [`Year 3: ${m.devicesDueIn3Years?.count ?? 0} devices`, `$${Math.round(m.devicesDueIn3Years?.projectedCost ?? 0).toLocaleString()}`],
    ]
    forecastStats.forEach(([label, value], i) => {
      const y = 97 + i * 8
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(107, 114, 128)
      doc.setFontSize(9)
      doc.text(label, marginL + 8, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text(value, pageW - marginR - 8, y, { align: 'right' })
    })
  } else if (reportType === 'repair-replace') {
    const m = metrics as unknown as RepairReplaceMetrics
    doc.setFillColor(...accentLight)
    doc.roundedRect(marginL, 75, contentW, 35, 4, 4, 'F')
    const rrStats = [
      ['Devices Analyzed', String(m.lemonDevices?.length ?? 0)],
      ['Total Repair Cost (replaceable)', `$${Math.round(m.totalRepairCost ?? 0).toLocaleString()}`],
      ['Total Replacement Cost', `$${Math.round(m.totalReplacementCost ?? 0).toLocaleString()}`],
    ]
    rrStats.forEach(([label, value], i) => {
      const y = 87 + i * 8
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(107, 114, 128)
      doc.setFontSize(9)
      doc.text(label, marginL + 8, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text(value, pageW - marginR - 8, y, { align: 'right' })
    })
  } else if (reportType === 'damage-fees') {
    const m = metrics as unknown as DamageFeeCollectionMetrics
    doc.setFillColor(...accentLight)
    doc.roundedRect(marginL, 75, contentW, 35, 4, 4, 'F')
    const dfStats = [
      ['Total Assessed', `$${Math.round(m.totalAssessed ?? 0).toLocaleString()}`],
      ['Total Collected', `$${Math.round(m.totalPaid ?? 0).toLocaleString()}`],
      ['Outstanding', `$${Math.round(m.totalOutstanding ?? 0).toLocaleString()}`],
    ]
    dfStats.forEach(([label, value], i) => {
      const y = 87 + i * 8
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(107, 114, 128)
      doc.setFontSize(9)
      doc.text(label, marginL + 8, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text(value, pageW - marginR - 8, y, { align: 'right' })
    })
  }
}

// ─── Annual Report Data Pages ───────────────────────────────────────────────

function renderAnnualDataPages(
  doc: jsPDF,
  m: AnnualTechReportMetrics,
  marginL: number,
  contentW: number,
  pageW: number,
  marginR: number,
  accentColor: [number, number, number],
  accentLight: [number, number, number],
  accentBorder: [number, number, number],
  addFooter: (n: number) => void
) {
  // ── Page 3: Key Metrics ─────────────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Key Metrics', marginL, 14)

  const col1X = marginL
  const col2X = pageW / 2 + 5
  const colW = contentW / 2 - 5

  const metricCards = [
    { label: 'Total Devices', value: String(m.totalDevices), sub: `${m.activeDevices} active` },
    { label: 'Repair Rate', value: `${m.repairRate}%`, sub: 'Devices with repairs' },
    { label: 'Cost Per Student', value: m.costPerStudent != null ? `$${m.costPerStudent.toFixed(2)}` : 'N/A', sub: 'Annual tech spend' },
    { label: 'IT Staff Ratio', value: m.itStaffToStudentRatio ?? 'N/A', sub: 'Staff to student' },
  ]

  metricCards.forEach((card, i) => {
    const col = i % 2 === 0 ? col1X : col2X
    const row = Math.floor(i / 2)
    const y = 28 + row * 38
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(229, 231, 235)
    doc.roundedRect(col, y, colW, 32, 3, 3, 'FD')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(card.label, col + 6, y + 9)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(card.value, col + 6, y + 21)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(card.sub, col + 6, y + 29)
  })

  // Fleet Age Distribution
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Fleet Age Distribution', marginL, 120)

  const ageHeaders = ['Age Range', 'Device Count']
  const ageColW = [80, 80]
  let yAge = 126

  doc.setFillColor(17, 24, 39)
  doc.rect(marginL, yAge, contentW, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  let xAge = marginL + 3
  ageHeaders.forEach((h, i) => {
    doc.text(h, xAge, yAge + 5.5)
    xAge += ageColW[i]
  })
  yAge += 8

  ;(m.fleetAgeDistribution ?? []).forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(marginL, yAge, contentW, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    doc.text(row.range, marginL + 3, yAge + 5.5)
    doc.text(String(row.count), marginL + 3 + ageColW[0], yAge + 5.5)
    yAge += 8
  })

  // Top Issue Types
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Top Issue Types', marginL, yAge + 12)
  yAge += 18

  doc.setFillColor(17, 24, 39)
  doc.rect(marginL, yAge, contentW, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Issue Type', marginL + 3, yAge + 5.5)
  doc.text('Count', marginL + 3 + 80, yAge + 5.5)
  yAge += 8

  ;(m.topIssueTypes ?? []).forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(marginL, yAge, contentW, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    doc.text(row.issueType.replace(/_/g, ' '), marginL + 3, yAge + 5.5)
    doc.text(String(row.count), marginL + 3 + 80, yAge + 5.5)
    yAge += 8
  })

  addFooter(3)

  // ── Page 4: Year-over-Year Comparison ─────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Year-over-Year Comparison', marginL, 14)

  const yoy = m.yoyComparison
  if (yoy) {
    const yoyColW = contentW / 3 - 4
    const yoyCards = [
      {
        label: 'Ticket Volume',
        thisVal: String(yoy.thisYear.ticketCount),
        lastVal: String(yoy.lastYear.ticketCount),
        improved: yoy.thisYear.ticketCount <= yoy.lastYear.ticketCount,
        delta:
          yoy.lastYear.ticketCount > 0
            ? Math.abs(
                Math.round(
                  ((yoy.thisYear.ticketCount - yoy.lastYear.ticketCount) /
                    yoy.lastYear.ticketCount) *
                    100
                )
              )
            : 0,
      },
      {
        label: 'Device Count',
        thisVal: String(yoy.thisYear.deviceCount),
        lastVal: String(yoy.lastYear.deviceCount),
        improved: true, // More devices is neutral
        delta:
          yoy.lastYear.deviceCount > 0
            ? Math.abs(
                Math.round(
                  ((yoy.thisYear.deviceCount - yoy.lastYear.deviceCount) /
                    yoy.lastYear.deviceCount) *
                    100
                )
              )
            : 0,
      },
      {
        label: 'Repair Cost',
        thisVal: `$${Math.round(yoy.thisYear.totalRepairCost).toLocaleString()}`,
        lastVal: `$${Math.round(yoy.lastYear.totalRepairCost).toLocaleString()}`,
        improved: yoy.thisYear.totalRepairCost <= yoy.lastYear.totalRepairCost,
        delta:
          yoy.lastYear.totalRepairCost > 0
            ? Math.abs(
                Math.round(
                  ((yoy.thisYear.totalRepairCost - yoy.lastYear.totalRepairCost) /
                    yoy.lastYear.totalRepairCost) *
                    100
                )
              )
            : 0,
      },
    ]

    yoyCards.forEach((card, i) => {
      const ex = marginL + i * (yoyColW + 4)
      const bg: [number, number, number] = card.improved ? accentLight : [254, 242, 242]
      const border: [number, number, number] = card.improved ? accentBorder : [252, 165, 165]
      doc.setFillColor(...bg)
      doc.setDrawColor(...border)
      doc.roundedRect(ex, 28, yoyColW, 50, 3, 3, 'FD')

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(107, 114, 128)
      doc.text(card.label, ex + 5, 38)

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text(card.thisVal, ex + 5, 52)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(107, 114, 128)
      doc.text(`Last year: ${card.lastVal}`, ex + 5, 62)

      const deltaColor: [number, number, number] = card.improved
        ? accentColor
        : [239, 68, 68]
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...deltaColor)
      doc.text(`${card.improved ? '▼' : '▲'} ${card.delta}%`, ex + 5, 72)
    })
  }

  addFooter(4)

  // ── Page 5: Fleet Age Visual ──────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Fleet Age & Issue Breakdown', marginL, 14)

  // Fleet age bar chart (simple horizontal bars)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Device Age Distribution', marginL, 30)

  const maxAgeCount = Math.max(
    ...(m.fleetAgeDistribution ?? []).map((d) => d.count),
    1
  )
  const barMaxW = contentW - 60

  ;(m.fleetAgeDistribution ?? []).forEach((row, i) => {
    const y = 38 + i * 14
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 65, 81)
    doc.text(row.range, marginL, y + 4)

    const barW = Math.max((row.count / maxAgeCount) * barMaxW, 2)
    doc.setFillColor(...accentColor)
    doc.roundedRect(marginL + 50, y, barW, 8, 2, 2, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(String(row.count), marginL + 52 + barW, y + 5.5)
  })

  addFooter(5)
}

// ─── Refresh Forecast Data Pages ────────────────────────────────────────────

function renderRefreshDataPages(
  doc: jsPDF,
  m: RefreshForecastMetrics,
  marginL: number,
  contentW: number,
  pageW: number,
  marginR: number,
  accentColor: [number, number, number],
  accentLight: [number, number, number],
  accentBorder: [number, number, number],
  addFooter: (n: number) => void
) {
  // ── Page 3: Forecast Summary ──────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Refresh Forecast Details', marginL, 14)

  // Forecast cards
  const eolColW = contentW / 3 - 4
  const buckets = [
    { label: 'Year 1 (Immediate)', data: m.devicesDueIn1Year },
    { label: 'Year 2', data: m.devicesDueIn2Years },
    { label: 'Year 3', data: m.devicesDueIn3Years },
  ]

  buckets.forEach((bucket, i) => {
    const ex = marginL + i * (eolColW + 4)
    doc.setFillColor(...accentLight)
    doc.setDrawColor(...accentBorder)
    doc.roundedRect(ex, 28, eolColW, 30, 3, 3, 'FD')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(bucket.label, ex + 5, 37)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(`${bucket.data.count} devices`, ex + 5, 48)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(`$${Math.round(bucket.data.projectedCost).toLocaleString()}`, ex + 5, 55)
  })

  // Staggered Budget
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Staggered Budget Recommendation', marginL, 72)

  const budgetTotal =
    m.staggeredBudget.year1 + m.staggeredBudget.year2 + m.staggeredBudget.year3
  const budgetItems = [
    { label: 'Year 1', amount: m.staggeredBudget.year1 },
    { label: 'Year 2', amount: m.staggeredBudget.year2 },
    { label: 'Year 3', amount: m.staggeredBudget.year3 },
    { label: 'Total (3-Year)', amount: budgetTotal },
  ]
  let yBudget = 78
  budgetItems.forEach((item, idx) => {
    const isTotal = idx === budgetItems.length - 1
    if (isTotal) {
      doc.setFillColor(...accentLight)
      doc.rect(marginL, yBudget, contentW, 8, 'F')
    } else if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(marginL, yBudget, contentW, 8, 'F')
    }
    doc.setFontSize(9)
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal')
    doc.setTextColor(17, 24, 39)
    doc.text(item.label, marginL + 3, yBudget + 5.5)
    doc.text(`$${Math.round(item.amount).toLocaleString()}`, pageW - marginR - 3, yBudget + 5.5, {
      align: 'right',
    })
    yBudget += 8
  })

  // Model breakdown tables
  let yModel = yBudget + 15
  buckets.forEach((bucket) => {
    if (bucket.data.models.length === 0) return
    if (yModel > 240) return // Skip if near page bottom

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(`${bucket.label} — By Model`, marginL, yModel)
    yModel += 5

    doc.setFillColor(17, 24, 39)
    doc.rect(marginL, yModel, contentW, 8, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Model', marginL + 3, yModel + 5.5)
    doc.text('Count', marginL + 90, yModel + 5.5)
    doc.text('Est. Cost', marginL + 120, yModel + 5.5)
    yModel += 8

    bucket.data.models.slice(0, 8).forEach((row, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(249, 250, 251)
        doc.rect(marginL, yModel, contentW, 8, 'F')
      }
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(17, 24, 39)
      const modelName = row.model.length > 35 ? row.model.slice(0, 33) + '...' : row.model
      doc.text(modelName, marginL + 3, yModel + 5.5)
      doc.text(String(row.count), marginL + 90, yModel + 5.5)
      doc.text(`$${Math.round(row.estCost).toLocaleString()}`, marginL + 120, yModel + 5.5)
      yModel += 8
    })
    yModel += 8
  })

  addFooter(3)

  // ── Page 4: Additional model details if needed ────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Budget Planning Notes', marginL, 14)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(55, 65, 81)
  const notes = [
    `Device refresh threshold: ${m.thresholdYears} years from purchase date.`,
    `Projected costs are based on original purchase prices as replacement estimates.`,
    `Staggered budgeting spreads replacement costs over 3 fiscal years.`,
    `Year 1 includes devices that are already past their refresh threshold.`,
    `Actual costs may vary based on vendor negotiations, bulk discounts, and model changes.`,
    `Consider leasing options for Year 2-3 devices to reduce upfront capital expenditure.`,
  ]
  notes.forEach((note, i) => {
    doc.text(`  •  ${note}`, marginL, 30 + i * 8)
  })

  addFooter(4)
}

// ─── Repair vs Replace Data Pages ───────────────────────────────────────────

function renderRepairReplaceDataPages(
  doc: jsPDF,
  m: RepairReplaceMetrics,
  marginL: number,
  contentW: number,
  pageW: number,
  marginR: number,
  accentColor: [number, number, number],
  accentLight: [number, number, number],
  _accentBorder: [number, number, number],
  addFooter: (n: number) => void
) {
  // ── Page 3: Device Table ──────────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Repair vs Replace Analysis', marginL, 14)

  // Summary cards
  const col3W = contentW / 3 - 4
  const summaryCards = [
    { label: 'Total Repair Cost', value: `$${Math.round(m.totalRepairCost).toLocaleString()}`, color: [239, 68, 68] as [number, number, number] },
    { label: 'Replacement Cost', value: `$${Math.round(m.totalReplacementCost).toLocaleString()}`, color: accentColor },
    { label: 'Net Savings', value: `$${Math.round(Math.abs(m.netSavings)).toLocaleString()}`, color: m.netSavings > 0 ? [5, 150, 105] as [number, number, number] : [239, 68, 68] as [number, number, number] },
  ]
  summaryCards.forEach((card, i) => {
    const ex = marginL + i * (col3W + 4)
    doc.setFillColor(...accentLight)
    doc.roundedRect(ex, 28, col3W, 24, 3, 3, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(card.label, ex + 5, 36)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...card.color)
    doc.text(card.value, ex + 5, 47)
  })

  // Device table
  const headers = ['#', 'Asset Tag', 'Model', 'Repair $', 'Replace $', 'Action']
  const colWidths = [10, 28, 42, 28, 28, 24]
  let y3 = 60

  doc.setFillColor(17, 24, 39)
  doc.rect(marginL, y3, contentW, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  let x3 = marginL + 2
  headers.forEach((h, i) => {
    doc.text(h, x3, y3 + 5.5)
    x3 += colWidths[i]
  })
  y3 += 8

  const maxDevices = Math.min(m.lemonDevices.length, 25) // Limit to fit on page
  m.lemonDevices.slice(0, maxDevices).forEach((device, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(marginL, y3, contentW, 8, 'F')
    }
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    x3 = marginL + 2
    const modelName = (device.model ?? 'Unknown').length > 18
      ? (device.model ?? 'Unknown').slice(0, 16) + '...'
      : device.model ?? 'Unknown'

    const row = [
      String(idx + 1),
      device.assetTag,
      modelName,
      `$${Math.round(device.cumulativeRepairCost).toLocaleString()}`,
      `$${Math.round(device.estimatedReplacementCost).toLocaleString()}`,
      device.recommendation.toUpperCase(),
    ]
    row.forEach((cell, i) => {
      if (i === 5) {
        doc.setTextColor(
          ...(device.recommendation === 'replace'
            ? [239, 68, 68] as [number, number, number]
            : accentColor)
        )
        doc.setFont('helvetica', 'bold')
      } else {
        doc.setTextColor(17, 24, 39)
        doc.setFont('helvetica', 'normal')
      }
      doc.text(cell, x3, y3 + 5.5)
      x3 += colWidths[i]
    })
    y3 += 8
  })

  addFooter(3)

  // ── Page 4: Recommendations ───────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Replacement Recommendations', marginL, 14)

  const replaceCount = m.lemonDevices.filter(
    (d) => d.recommendation === 'replace'
  ).length
  const repairCount = m.lemonDevices.length - replaceCount

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(55, 65, 81)

  const recNotes = [
    `${m.lemonDevices.length} devices were analyzed based on cumulative repair history.`,
    `${replaceCount} device${replaceCount !== 1 ? 's' : ''} recommended for replacement (repair cost exceeds 60% of replacement value).`,
    `${repairCount} device${repairCount !== 1 ? 's' : ''} recommended to continue repairing.`,
    `Estimated total savings from replacing high-cost-repair devices: $${Math.round(Math.abs(m.netSavings)).toLocaleString()}.`,
    ``,
    `Replace-threshold policy: Devices are flagged for replacement when cumulative repair`,
    `costs exceed 60% of the estimated replacement cost (based on original purchase price).`,
  ]
  recNotes.forEach((note, i) => {
    doc.text(note.startsWith('') && note.length === 0 ? '' : `  ${note}`, marginL, 30 + i * 7)
  })

  addFooter(4)
}

// ─── Damage Fees Data Pages ─────────────────────────────────────────────────

function renderDamageFeesDataPages(
  doc: jsPDF,
  m: DamageFeeCollectionMetrics,
  marginL: number,
  contentW: number,
  pageW: number,
  marginR: number,
  accentColor: [number, number, number],
  accentLight: [number, number, number],
  accentBorder: [number, number, number],
  addFooter: (n: number) => void
) {
  // ── Page 3: Collection Summary ────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Fee Collection Details', marginL, 14)

  // Summary cards
  const col4W = contentW / 4 - 3
  const feeCards = [
    { label: 'Assessed', value: `$${Math.round(m.totalAssessed).toLocaleString()}` },
    { label: 'Collected', value: `$${Math.round(m.totalPaid).toLocaleString()}` },
    { label: 'Outstanding', value: `$${Math.round(m.totalOutstanding).toLocaleString()}` },
    { label: 'Waived', value: `$${Math.round(m.totalWaived).toLocaleString()}` },
  ]
  feeCards.forEach((card, i) => {
    const ex = marginL + i * (col4W + 3)
    doc.setFillColor(...accentLight)
    doc.setDrawColor(...accentBorder)
    doc.roundedRect(ex, 28, col4W, 24, 3, 3, 'FD')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(card.label, ex + 4, 36)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(card.value, ex + 4, 47)
  })

  // Collection rate
  const collectionRate =
    m.totalAssessed > 0
      ? Math.round((m.totalPaid / m.totalAssessed) * 100)
      : 0
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text(`Collection Rate: ${collectionRate}%`, marginL, 62)

  // By Condition table
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Fees by Condition', marginL, 74)

  let yC = 80
  doc.setFillColor(17, 24, 39)
  doc.rect(marginL, yC, contentW, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Condition', marginL + 3, yC + 5.5)
  doc.text('Count', marginL + 60, yC + 5.5)
  doc.text('Total Fee', marginL + 100, yC + 5.5)
  yC += 8

  ;(m.byCondition ?? []).forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(marginL, yC, contentW, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    doc.text(row.condition, marginL + 3, yC + 5.5)
    doc.text(String(row.count), marginL + 60, yC + 5.5)
    doc.text(`$${Math.round(row.totalFee).toLocaleString()}`, marginL + 100, yC + 5.5)
    yC += 8
  })

  // Aging Buckets table
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Outstanding Fee Aging', marginL, yC + 12)
  yC += 18

  doc.setFillColor(17, 24, 39)
  doc.rect(marginL, yC, contentW, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Aging Bucket', marginL + 3, yC + 5.5)
  doc.text('Count', marginL + 60, yC + 5.5)
  doc.text('Amount', marginL + 100, yC + 5.5)
  yC += 8

  ;(m.agingBuckets ?? []).forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(marginL, yC, contentW, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')

    // Color-code aging buckets
    if (row.bucket === '90-day+') {
      doc.setTextColor(239, 68, 68) // Red for overdue
    } else if (row.bucket === '60-day') {
      doc.setTextColor(245, 158, 11) // Amber for warning
    } else {
      doc.setTextColor(17, 24, 39)
    }

    doc.text(row.bucket, marginL + 3, yC + 5.5)
    doc.text(String(row.count), marginL + 60, yC + 5.5)
    doc.text(`$${Math.round(row.amount).toLocaleString()}`, marginL + 100, yC + 5.5)
    yC += 8
  })

  addFooter(3)

  // ── Page 4: By School Breakdown ───────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Fee Collection by School', marginL, 14)

  let yS = 24
  doc.setFillColor(17, 24, 39)
  doc.rect(marginL, yS, contentW, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('School', marginL + 3, yS + 5.5)
  doc.text('Assessed', marginL + 70, yS + 5.5)
  doc.text('Collected', marginL + 105, yS + 5.5)
  doc.text('Outstanding', marginL + 140, yS + 5.5)
  yS += 8

  ;(m.bySchool ?? []).forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(marginL, yS, contentW, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    const schoolName = row.schoolName.length > 25
      ? row.schoolName.slice(0, 23) + '...'
      : row.schoolName
    doc.text(schoolName, marginL + 3, yS + 5.5)
    doc.text(`$${Math.round(row.assessed).toLocaleString()}`, marginL + 70, yS + 5.5)
    doc.text(`$${Math.round(row.paid).toLocaleString()}`, marginL + 105, yS + 5.5)

    // Highlight outstanding amounts > 0
    if (row.outstanding > 0) {
      doc.setTextColor(239, 68, 68)
    }
    doc.text(`$${Math.round(row.outstanding).toLocaleString()}`, marginL + 140, yS + 5.5)
    doc.setTextColor(17, 24, 39)
    yS += 8
  })

  if ((m.bySchool ?? []).length === 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(107, 114, 128)
    doc.text('No school-level fee data available.', marginL, yS + 10)
  }

  addFooter(4)
}

// ─── 7. Ticket ROI Narrative ──────────────────────────────────────────────────

export interface TicketROIMetrics {
  totalTicketsResolved: number
  avgResolutionHours: number
  yoyImprovement: number | null // percentage
  estimatedCostSavings: number
  topIssueCategories: { issueType: string; count: number; avgHours: number }[]
  ticketsByMonth: { month: string; count: number }[]
}

export interface TicketROIResult {
  metrics: TicketROIMetrics
  narrative: string
}

export async function getTicketROINarrative(
  orgId: string,
  options: { from?: string; to?: string; schoolId?: string } = {}
): Promise<TicketROIResult> {
  const now = new Date()
  const from = options.from ? new Date(options.from) : new Date(now.getFullYear(), now.getMonth() - 12, 1)
  const to = options.to ? new Date(options.to) : now

  // Calculate prior period for YoY comparison
  const periodMs = to.getTime() - from.getTime()
  const priorFrom = new Date(from.getTime() - periodMs)
  const priorTo = from

  const schoolFilter = options.schoolId ? { schoolId: options.schoolId } : {}

  // Current period resolved tickets
  const currentTickets = await rawPrisma.iTTicket.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: 'DONE',
      updatedAt: { gte: from, lte: to },
      ...schoolFilter,
    },
    select: {
      id: true,
      issueType: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  // Prior period resolved tickets
  const priorTickets = await rawPrisma.iTTicket.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: 'DONE',
      updatedAt: { gte: priorFrom, lte: priorTo },
      ...schoolFilter,
    },
    select: { id: true, createdAt: true, updatedAt: true },
  })

  // Calculate metrics
  const totalTicketsResolved = currentTickets.length

  // Average resolution hours
  const resolutionHours = currentTickets.map((t) => {
    const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
    return Math.max(0, hours)
  })
  const avgResolutionHours = resolutionHours.length > 0
    ? Math.round((resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length) * 10) / 10
    : 0

  // Prior period avg resolution
  const priorResolutionHours = priorTickets.map((t) => {
    const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
    return Math.max(0, hours)
  })
  const priorAvgHours = priorResolutionHours.length > 0
    ? priorResolutionHours.reduce((a, b) => a + b, 0) / priorResolutionHours.length
    : null

  // YoY improvement (negative = better/faster)
  const yoyImprovement = priorAvgHours != null && priorAvgHours > 0
    ? Math.round(((priorAvgHours - avgResolutionHours) / priorAvgHours) * 100 * 10) / 10
    : null

  // Estimated cost savings (industry average: $15/ticket hour saved vs external support at $85/hr)
  const externalRate = 85
  const internalRate = 15
  const estimatedCostSavings = Math.round(totalTicketsResolved * avgResolutionHours * (externalRate - internalRate) / 100)

  // Top issue categories
  const issueMap = new Map<string, { count: number; totalHours: number }>()
  for (const t of currentTickets) {
    const entry = issueMap.get(t.issueType) ?? { count: 0, totalHours: 0 }
    entry.count++
    entry.totalHours += (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
    issueMap.set(t.issueType, entry)
  }
  const topIssueCategories = Array.from(issueMap.entries())
    .map(([issueType, data]) => ({
      issueType,
      count: data.count,
      avgHours: Math.round((data.totalHours / data.count) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // Tickets by month
  const monthMap = new Map<string, number>()
  for (const t of currentTickets) {
    const key = `${t.updatedAt.getFullYear()}-${String(t.updatedAt.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
  }
  const ticketsByMonth = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }))

  const metrics: TicketROIMetrics = {
    totalTicketsResolved,
    avgResolutionHours,
    yoyImprovement,
    estimatedCostSavings,
    topIssueCategories,
    ticketsByMonth,
  }

  // Generate narrative
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  })
  const orgName = org?.name ?? 'the organization'

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY

  let narrative: string

  if (apiKey) {
    try {
      const client = new GoogleGenAI({ apiKey })
      const prompt = `You are writing an IT Ticket ROI executive narrative for a K-12 school board presentation at ${orgName}. Be professional, concise (2-3 paragraphs), and highlight the value delivered by the IT team.

IT Ticket Metrics:
${JSON.stringify(metrics, null, 2)}

Write a 2-3 paragraph executive narrative that:
1. Summarizes IT ticket resolution performance (volume, speed, improvement trends)
2. Translates the metrics into business value and cost savings for the school
3. Identifies the most common issue categories and any recommendations

Do not use markdown formatting. Write in plain prose paragraphs.`

      const response = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      })
      narrative = response.text ?? buildROIFallbackNarrative(metrics, orgName)
    } catch (err) {
      console.error('[itBoardReportService] AI ROI narrative generation failed:', err)
      narrative = buildROIFallbackNarrative(metrics, orgName)
    }
  } else {
    narrative = buildROIFallbackNarrative(metrics, orgName)
  }

  return { metrics, narrative }
}

function buildROIFallbackNarrative(metrics: TicketROIMetrics, orgName: string): string {
  const { totalTicketsResolved, avgResolutionHours, yoyImprovement, estimatedCostSavings, topIssueCategories } = metrics

  const topCategory = topIssueCategories[0]?.issueType ?? 'general'
  const improvementText = yoyImprovement != null
    ? yoyImprovement > 0
      ? `Resolution speed has improved by ${yoyImprovement}% compared to the prior period.`
      : `Resolution speed has decreased by ${Math.abs(yoyImprovement)}% compared to the prior period, warranting further investigation.`
    : 'Year-over-year comparison data is not yet available.'

  return `IT Help Desk Performance — ${orgName}

During the reporting period, the IT team resolved ${totalTicketsResolved} support tickets with an average resolution time of ${avgResolutionHours} hours. ${improvementText} The most frequently addressed issue category was ${topCategory.replace('_', ' ').toLowerCase()}, accounting for ${topIssueCategories[0]?.count ?? 0} tickets.

By maintaining an in-house IT support operation, ${orgName} has realized an estimated cost savings of $${estimatedCostSavings.toLocaleString()} compared to outsourced support rates. The board is encouraged to continue investing in IT staffing and professional development to sustain and improve these outcomes.`
}
