/**
 * IT Board Report Service — AI Narrative Generation
 *
 * Generates executive narrative summaries using Gemini AI with template fallbacks.
 * Also includes the Ticket ROI narrative and metrics calculation.
 */

import { rawPrisma } from '@/lib/db'
import { GoogleGenAI } from '@google/genai'
import { logger } from '@/lib/logger'
import type { TicketROIMetrics, TicketROIResult } from './itBoardReport-types'

const log = logger.child({ service: 'itBoardReportService' })

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
    log.error({ err: String(err) }, 'AI narrative generation failed')
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

// ─── 7. Ticket ROI Narrative ──────────────────────────────────────────────────

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
      log.error({ err: String(err) }, 'AI ROI narrative generation failed')
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
