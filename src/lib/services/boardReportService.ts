/**
 * Board Report Service
 *
 * Aggregates FCI, cost, PM ratio, compliance, asset EOL, and YoY metrics
 * for the superintendent-ready board report. Also handles AI narrative
 * generation via Anthropic and PDF export via jsPDF.
 *
 * Uses rawPrisma for all queries — org ID is passed explicitly.
 */

import { rawPrisma } from '@/lib/db'
import { jsPDF } from 'jspdf'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FCIRating = 'GOOD' | 'FAIR' | 'POOR'

export type BoardReportMetrics = {
  period: { from: Date; to: Date }
  fci: {
    score: number
    deferred: number
    replacementValue: number
    rating: FCIRating
  }
  costPerStudent: number | null
  pmVsReactiveRatio: { pmCount: number; reactiveCount: number; pmPct: number }
  deferredBacklog: { count: number; estimatedCostUSD: number }
  responseTime: {
    avgHours: number
    byCategory: Record<string, number>
    byCampus: Record<string, number>
  }
  resolutionTime: {
    avgHours: number
    byCategory: Record<string, number>
    byCampus: Record<string, number>
  }
  complianceStatus: {
    byDomain: Record<
      string,
      { total: number; current: number; overdue: number; pct: number }
    >
  }
  assetEOLForecast: {
    in1Year: number
    in3Years: number
    in5Years: number
    totalReplacementCost1: number
    totalReplacementCost3: number
    totalReplacementCost5: number
  }
  topRepairCostAssets: Array<{
    assetId: string
    assetNumber: string
    name: string
    cumulativeRepairCost: number
    replacementCost: number | null
    repairPct: number
  }>
  yoyComparison: {
    thisYear: { ticketCount: number; totalCost: number; avgResolutionHours: number }
    lastYear: { ticketCount: number; totalCost: number; avgResolutionHours: number }
  }
}

// ─── FCI Calculation ──────────────────────────────────────────────────────────

function getFCIRating(score: number): FCIRating {
  if (score < 0.05) return 'GOOD'
  if (score <= 0.10) return 'FAIR'
  return 'POOR'
}

export async function calculateFCI(orgId: string): Promise<BoardReportMetrics['fci']> {
  const [assets, tickets] = await Promise.all([
    rawPrisma.maintenanceAsset.findMany({
      where: {
        organizationId: orgId,
        status: 'ACTIVE',
        replacementCost: { not: null },
        deletedAt: null,
      },
      select: { replacementCost: true },
    }),
    rawPrisma.maintenanceTicket.findMany({
      where: {
        organizationId: orgId,
        status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD'] },
        estimatedRepairCostUSD: { not: null },
        deletedAt: null,
      },
      select: { estimatedRepairCostUSD: true },
    }),
  ])

  const totalReplacementValue = assets.reduce(
    (sum, a) => sum + (a.replacementCost ?? 0),
    0
  )
  const deferredMaintenance = tickets.reduce(
    (sum, t) => sum + (t.estimatedRepairCostUSD ?? 0),
    0
  )

  const score =
    totalReplacementValue > 0 ? deferredMaintenance / totalReplacementValue : 0

  return {
    score,
    deferred: deferredMaintenance,
    replacementValue: totalReplacementValue,
    rating: getFCIRating(score),
  }
}

// ─── Main Metrics Aggregation ─────────────────────────────────────────────────

export async function getBoardReportMetrics(
  orgId: string,
  filters: { from: Date; to: Date; schoolId?: string }
): Promise<BoardReportMetrics> {
  const { from, to, schoolId } = filters

  const ticketWhere: Record<string, unknown> = {
    organizationId: orgId,
    createdAt: { gte: from, lte: to },
    deletedAt: null,
  }
  if (schoolId) ticketWhere.schoolId = schoolId

  const now = new Date()
  const in1Year = new Date(now)
  in1Year.setFullYear(in1Year.getFullYear() + 1)
  const in3Years = new Date(now)
  in3Years.setFullYear(in3Years.getFullYear() + 3)
  const in5Years = new Date(now)
  in5Years.setFullYear(in5Years.getFullYear() + 5)

  // YoY date range
  const yoyFrom = new Date(from)
  yoyFrom.setFullYear(yoyFrom.getFullYear() - 1)
  const yoyTo = new Date(to)
  yoyTo.setFullYear(yoyTo.getFullYear() - 1)

  const [
    allTickets,
    doneTickets,
    fciResult,
    allAssets,
    complianceRecords,
    orgInfo,
    yoyTickets,
  ] = await Promise.all([
    // All tickets in period for PM/reactive ratio and backlog
    rawPrisma.maintenanceTicket.findMany({
      where: ticketWhere,
      select: {
        id: true,
        status: true,
        pmScheduleId: true,
        estimatedRepairCostUSD: true,
        category: true,
        schoolId: true,
        createdAt: true,
        updatedAt: true,
        costEntries: { select: { amount: true } },
        laborEntries: {
          select: {
            durationMinutes: true,
            technician: {
              select: {
                technicianProfile: { select: { loadedHourlyRate: true } },
              },
            },
          },
        },
      },
    }),

    // DONE tickets for response/resolution time
    rawPrisma.maintenanceTicket.findMany({
      where: { ...ticketWhere, status: { in: ['DONE', 'QA'] } },
      select: {
        id: true,
        category: true,
        schoolId: true,
        createdAt: true,
        updatedAt: true,
        activities: {
          where: { type: 'STATUS_CHANGE', toStatus: 'IN_PROGRESS' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),

    // FCI
    calculateFCI(orgId),

    // All assets for EOL forecast and top repair costs (with ticket costs via relation)
    rawPrisma.maintenanceAsset.findMany({
      where: {
        organizationId: orgId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        assetNumber: true,
        name: true,
        purchaseDate: true,
        expectedLifespanYears: true,
        replacementCost: true,
        tickets: {
          where: { deletedAt: null },
          select: {
            costEntries: { select: { amount: true } },
            laborEntries: {
              select: {
                durationMinutes: true,
                technician: {
                  select: {
                    technicianProfile: { select: { loadedHourlyRate: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),

    // Compliance records
    rawPrisma.complianceRecord.findMany({
      where: { organizationId: orgId },
      select: {
        domain: true,
        status: true,
      },
    }),

    // Org info for cost per student
    rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: { studentCount: true, name: true },
    }),

    // YoY tickets (last year, same date range shifted back 1 year)
    rawPrisma.maintenanceTicket.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: yoyFrom, lte: yoyTo },
        deletedAt: null,
        ...(schoolId ? { schoolId } : {}),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        costEntries: { select: { amount: true } },
        laborEntries: {
          select: {
            durationMinutes: true,
            technician: {
              select: {
                technicianProfile: { select: { loadedHourlyRate: true } },
              },
            },
          },
        },
      },
    }),
  ])

  // ── PM vs Reactive ──────────────────────────────────────────────────────────
  const pmCount = allTickets.filter((t) => t.pmScheduleId != null).length
  const reactiveCount = allTickets.filter((t) => t.pmScheduleId == null).length
  const totalTickets = allTickets.length
  const pmPct = totalTickets > 0 ? Math.round((pmCount / totalTickets) * 100) : 0

  // ── Deferred Backlog ────────────────────────────────────────────────────────
  const openStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD']
  const openTickets = allTickets.filter((t) => openStatuses.includes(t.status))
  const deferredBacklogCount = openTickets.length
  const deferredBacklogCost = openTickets.reduce(
    (sum, t) => sum + (t.estimatedRepairCostUSD ?? 0),
    0
  )

  // ── Response/Resolution Time ────────────────────────────────────────────────
  const responseHoursAll: number[] = []
  const responseByCat: Record<string, number[]> = {}
  const responseByCampus: Record<string, number[]> = {}
  const resolutionHoursAll: number[] = []
  const resolutionByCat: Record<string, number[]> = {}
  const resolutionByCampus: Record<string, number[]> = {}

  for (const t of doneTickets) {
    const cat = t.category ?? 'OTHER'
    const campus = t.schoolId ?? 'all'

    // Response time: createdAt → first IN_PROGRESS activity
    if (t.activities.length > 0) {
      const firstActivity = t.activities[0]
      const diffMs = firstActivity.createdAt.getTime() - t.createdAt.getTime()
      const hours = diffMs / (1000 * 60 * 60)
      if (hours >= 0) {
        responseHoursAll.push(hours)
        ;(responseByCat[cat] = responseByCat[cat] ?? []).push(hours)
        ;(responseByCampus[campus] = responseByCampus[campus] ?? []).push(hours)
      }
    }

    // Resolution time: createdAt → updatedAt (for DONE tickets)
    const resMs = t.updatedAt.getTime() - t.createdAt.getTime()
    const resHours = resMs / (1000 * 60 * 60)
    if (resHours >= 0) {
      resolutionHoursAll.push(resHours)
      ;(resolutionByCat[cat] = resolutionByCat[cat] ?? []).push(resHours)
      ;(resolutionByCampus[campus] = resolutionByCampus[campus] ?? []).push(resHours)
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const avgMap = (m: Record<string, number[]>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, avg(v)]))

  // ── Compliance Status ───────────────────────────────────────────────────────
  const complianceByDomain: BoardReportMetrics['complianceStatus']['byDomain'] = {}
  for (const rec of complianceRecords) {
    const d = rec.domain as string
    if (!complianceByDomain[d]) {
      complianceByDomain[d] = { total: 0, current: 0, overdue: 0, pct: 0 }
    }
    complianceByDomain[d].total++
    if (rec.status === 'CURRENT') complianceByDomain[d].current++
    if (rec.status === 'OVERDUE') complianceByDomain[d].overdue++
  }
  for (const d of Object.keys(complianceByDomain)) {
    const { total, current } = complianceByDomain[d]
    complianceByDomain[d].pct = total > 0 ? Math.round((current / total) * 100) : 0
  }

  // ── Asset EOL Forecast ──────────────────────────────────────────────────────
  let in1YearCount = 0
  let in3YearsCount = 0
  let in5YearsCount = 0
  let totalRC1 = 0
  let totalRC3 = 0
  let totalRC5 = 0

  for (const asset of allAssets) {
    if (!asset.purchaseDate || !asset.expectedLifespanYears) continue
    const eolDate = new Date(asset.purchaseDate)
    eolDate.setFullYear(eolDate.getFullYear() + asset.expectedLifespanYears)

    if (eolDate <= in5Years) {
      in5YearsCount++
      totalRC5 += asset.replacementCost ?? 0
      if (eolDate <= in3Years) {
        in3YearsCount++
        totalRC3 += asset.replacementCost ?? 0
        if (eolDate <= in1Year) {
          in1YearCount++
          totalRC1 += asset.replacementCost ?? 0
        }
      }
    }
  }

  // ── Top Repair Cost Assets ──────────────────────────────────────────────────
  const assetRepairCosts = allAssets.map((asset) => {
    let cumulativeRepairCost = 0
    for (const ticket of asset.tickets) {
      for (const entry of ticket.costEntries) {
        cumulativeRepairCost += entry.amount
      }
      for (const labor of ticket.laborEntries) {
        if (
          labor.durationMinutes &&
          labor.technician?.technicianProfile?.loadedHourlyRate
        ) {
          cumulativeRepairCost +=
            (labor.durationMinutes / 60) *
            labor.technician.technicianProfile.loadedHourlyRate
        }
      }
    }
    const repairPct =
      asset.replacementCost && asset.replacementCost > 0
        ? cumulativeRepairCost / asset.replacementCost
        : 0
    return {
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      name: asset.name,
      cumulativeRepairCost,
      replacementCost: asset.replacementCost,
      repairPct,
    }
  })
  const topRepairCostAssets = assetRepairCosts
    .sort((a, b) => b.cumulativeRepairCost - a.cumulativeRepairCost)
    .slice(0, 10)

  // ── Cost Per Student ────────────────────────────────────────────────────────
  const ticketCostThisYear = computeTicketsTotalCost(allTickets)
  const studentCount = orgInfo?.studentCount
  const costPerStudent =
    studentCount && studentCount > 0
      ? ticketCostThisYear / studentCount
      : null

  // ── YoY Comparison ──────────────────────────────────────────────────────────
  const yoyTotalCost = computeTicketsTotalCost(yoyTickets)
  const yoyDoneTickets = yoyTickets.filter(
    (t) => t.status === 'DONE' || t.status === 'QA'
  )

  const thisYearAvgRes = avg(resolutionHoursAll)
  const lastYearAvgRes =
    yoyDoneTickets.length > 0
      ? avg(
          yoyDoneTickets.map((t) => {
            const ms = t.updatedAt.getTime() - t.createdAt.getTime()
            return ms / (1000 * 60 * 60)
          })
        )
      : 0

  return {
    period: { from, to },
    fci: fciResult,
    costPerStudent,
    pmVsReactiveRatio: { pmCount, reactiveCount, pmPct },
    deferredBacklog: { count: deferredBacklogCount, estimatedCostUSD: deferredBacklogCost },
    responseTime: {
      avgHours: avg(responseHoursAll),
      byCategory: avgMap(responseByCat),
      byCampus: avgMap(responseByCampus),
    },
    resolutionTime: {
      avgHours: avg(resolutionHoursAll),
      byCategory: avgMap(resolutionByCat),
      byCampus: avgMap(resolutionByCampus),
    },
    complianceStatus: { byDomain: complianceByDomain },
    assetEOLForecast: {
      in1Year: in1YearCount,
      in3Years: in3YearsCount,
      in5Years: in5YearsCount,
      totalReplacementCost1: totalRC1,
      totalReplacementCost3: totalRC3,
      totalReplacementCost5: totalRC5,
    },
    topRepairCostAssets,
    yoyComparison: {
      thisYear: {
        ticketCount: allTickets.length,
        totalCost: ticketCostThisYear,
        avgResolutionHours: thisYearAvgRes,
      },
      lastYear: {
        ticketCount: yoyTickets.length,
        totalCost: yoyTotalCost,
        avgResolutionHours: lastYearAvgRes,
      },
    },
  }
}

// ─── Helper: compute total cost from tickets with cost/labor entries ──────────

type TicketWithCosts = {
  costEntries: Array<{ amount: number }>
  laborEntries: Array<{
    durationMinutes: number | null
    technician: {
      technicianProfile: { loadedHourlyRate: number | null } | null
    } | null
  }>
}

function computeTicketsTotalCost(tickets: TicketWithCosts[]): number {
  let total = 0
  for (const t of tickets) {
    for (const entry of t.costEntries) {
      total += entry.amount
    }
    for (const labor of t.laborEntries) {
      if (
        labor.durationMinutes &&
        labor.technician?.technicianProfile?.loadedHourlyRate
      ) {
        total +=
          (labor.durationMinutes / 60) *
          labor.technician.technicianProfile.loadedHourlyRate
      }
    }
  }
  return total
}

// ─── AI Narrative Generation ──────────────────────────────────────────────────

export async function generateAINarrative(
  metrics: BoardReportMetrics,
  orgName: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  const complianceSummary = Object.entries(metrics.complianceStatus.byDomain)
    .map(([domain, d]) => `${domain}: ${d.current}/${d.total} current (${d.overdue} overdue)`)
    .join(', ')

  const metricsJson = {
    fciScore: metrics.fci.score.toFixed(3),
    fciRating: metrics.fci.rating,
    fciDeferred: Math.round(metrics.fci.deferred),
    deferredCount: metrics.deferredBacklog.count,
    deferredCost: Math.round(metrics.deferredBacklog.estimatedCostUSD),
    pmPct: metrics.pmVsReactiveRatio.pmPct,
    costPerStudent: metrics.costPerStudent ? metrics.costPerStudent.toFixed(2) : 'N/A',
    complianceSummary,
    eolIn1Year: metrics.assetEOLForecast.in1Year,
    eolIn3Years: metrics.assetEOLForecast.in3Years,
    topAsset:
      metrics.topRepairCostAssets.length > 0
        ? `${metrics.topRepairCostAssets[0].name} at $${Math.round(metrics.topRepairCostAssets[0].cumulativeRepairCost).toLocaleString()} cumulative`
        : 'None',
    yoyTickets: {
      this: metrics.yoyComparison.thisYear.ticketCount,
      last: metrics.yoyComparison.lastYear.ticketCount,
    },
    yoyResolution: {
      this: metrics.yoyComparison.thisYear.avgResolutionHours.toFixed(1),
      last: metrics.yoyComparison.lastYear.avgResolutionHours.toFixed(1),
    },
  }

  const prompt = `You are writing an executive narrative summary for a K-12 school board facilities report for ${orgName}. Be professional, concise (3-4 paragraphs), and highlight key findings and recommendations. The tone should be informative but accessible to non-technical board members.

Facilities Data:
- FCI Score: ${metricsJson.fciScore} (${metricsJson.fciRating}) — ${metricsJson.fciRating === 'GOOD' ? 'facility is in good condition' : metricsJson.fciRating === 'FAIR' ? 'attention recommended' : 'immediate action required'}
- Deferred maintenance backlog: ${metricsJson.deferredCount} tickets, estimated $${metricsJson.deferredCost.toLocaleString()}
- PM vs Reactive ratio: ${metricsJson.pmPct}% preventive maintenance
- Cost per student: $${metricsJson.costPerStudent}
- Compliance: ${metricsJson.complianceSummary || 'No compliance data available'}
- Assets reaching end of life: ${metricsJson.eolIn1Year} in next year, ${metricsJson.eolIn3Years} in 3 years
- Top repair cost asset: ${metricsJson.topAsset}
- Year-over-year: ticket volume ${metricsJson.yoyTickets.this > metricsJson.yoyTickets.last ? 'up' : 'down'} from ${metricsJson.yoyTickets.last} to ${metricsJson.yoyTickets.this}, avg resolution ${parseFloat(metricsJson.yoyResolution.this) < parseFloat(metricsJson.yoyResolution.last) ? 'faster' : 'slower'} (${metricsJson.yoyResolution.this}h vs ${metricsJson.yoyResolution.last}h last year)

Write a 3-4 paragraph executive narrative.`

  if (!apiKey) {
    return buildFallbackNarrative(orgName, metrics)
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const content = response.content[0]
    if (content.type === 'text') return content.text
    return buildFallbackNarrative(orgName, metrics)
  } catch (err) {
    console.error('[boardReportService] AI narrative generation failed:', err)
    return buildFallbackNarrative(orgName, metrics)
  }
}

function buildFallbackNarrative(orgName: string, metrics: BoardReportMetrics): string {
  const fciLabel =
    metrics.fci.rating === 'GOOD'
      ? 'good condition'
      : metrics.fci.rating === 'FAIR'
      ? 'fair condition requiring attention'
      : 'poor condition requiring immediate action'

  return `Executive Summary — ${orgName} Facilities Report

This report covers facility operations for the period ending ${metrics.period.to.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. The Facility Condition Index (FCI) score of ${(metrics.fci.score * 100).toFixed(1)}% places ${orgName}'s facilities in ${fciLabel}. Total deferred maintenance backlog stands at ${metrics.deferredBacklog.count} open work orders with an estimated cost of $${Math.round(metrics.deferredBacklog.estimatedCostUSD).toLocaleString()}.

Preventive maintenance accounts for ${metrics.pmVsReactiveRatio.pmPct}% of all maintenance activity${metrics.pmVsReactiveRatio.pmPct >= 60 ? ', demonstrating a strong proactive maintenance culture' : '. Increasing this ratio is recommended to reduce reactive repair costs'}. ${metrics.costPerStudent != null ? `The current cost per student is $${metrics.costPerStudent.toFixed(2)}.` : ''}

Asset end-of-life projections indicate ${metrics.assetEOLForecast.in1Year} assets reaching end of life within the next year and ${metrics.assetEOLForecast.in3Years} within three years, representing $${Math.round(metrics.assetEOLForecast.totalReplacementCost3).toLocaleString()} in projected replacement costs. The board should consider capital planning for these replacements in the upcoming budget cycle.

Year-over-year, ticket volume has ${metrics.yoyComparison.thisYear.ticketCount > metrics.yoyComparison.lastYear.ticketCount ? 'increased' : 'decreased'} from ${metrics.yoyComparison.lastYear.ticketCount} to ${metrics.yoyComparison.thisYear.ticketCount} work orders. The maintenance team continues to demonstrate strong operational performance and fiscal responsibility in managing campus facilities.`
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export async function exportBoardReportPDF(
  orgId: string,
  orgName: string,
  metrics: BoardReportMetrics,
  narrative: string
): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = 210
  const pageH = 297
  const marginL = 20
  const marginR = 20
  const contentW = pageW - marginL - marginR
  const totalPages = 6

  const fciColor: [number, number, number] =
    metrics.fci.rating === 'GOOD'
      ? [5, 150, 105]
      : metrics.fci.rating === 'FAIR'
      ? [245, 158, 11]
      : [239, 68, 68]

  const periodStr = `${metrics.period.from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} – ${metrics.period.to.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
  const generatedStr = `Generated: ${new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`

  const addFooter = (pageNum: number) => {
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'normal')
    doc.text(`${orgName} — Lionheart Facilities Management`, marginL, pageH - 8)
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - marginR, pageH - 8, { align: 'right' })
    doc.setDrawColor(220, 220, 220)
    doc.line(marginL, pageH - 12, pageW - marginR, pageH - 12)
  }

  // ── Page 1: Cover ────────────────────────────────────────────────────────────
  doc.setFillColor(5, 150, 105)
  doc.rect(0, 0, pageW, 60, 'F')

  doc.setFontSize(9)
  doc.setTextColor(209, 250, 229)
  doc.setFont('helvetica', 'bold')
  doc.text('LIONHEART FACILITIES MANAGEMENT', marginL, 20)

  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text('Facilities Board Report', marginL, 35)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text(orgName, marginL, 46)
  doc.setFontSize(10)
  doc.text(periodStr, marginL, 54)

  // FCI Score box
  doc.setFillColor(...fciColor)
  doc.roundedRect(marginL, 75, 80, 50, 4, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('FACILITY CONDITION INDEX', marginL + 8, 86)
  doc.setFontSize(36)
  doc.text(`${(metrics.fci.score * 100).toFixed(1)}%`, marginL + 8, 108)
  doc.setFontSize(12)
  doc.text(metrics.fci.rating, marginL + 8, 118)

  // Sub stats
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(marginL + 88, 75, contentW - 88, 50, 4, 4, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(75, 85, 99)

  const stats = [
    ['Deferred Maintenance', `$${Math.round(metrics.fci.deferred).toLocaleString()}`],
    ['Replacement Value', `$${Math.round(metrics.fci.replacementValue).toLocaleString()}`],
    ['PM vs Reactive', `${metrics.pmVsReactiveRatio.pmPct}% preventive`],
    ['Cost Per Student', metrics.costPerStudent != null ? `$${metrics.costPerStudent.toFixed(2)}` : 'N/A'],
  ]
  stats.forEach(([label, value], i) => {
    const y = 87 + i * 11
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(label, marginL + 92, y)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(value, pageW - marginR, y, { align: 'right' })
  })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(150, 150, 150)
  doc.text(generatedStr, marginL, 145)

  addFooter(1)

  // ── Page 2: Executive Summary ────────────────────────────────────────────────
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

  // ── Page 3: Key Metrics ───────────────────────────────────────────────────────
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
    { label: 'FCI Score', value: `${(metrics.fci.score * 100).toFixed(1)}%`, sub: metrics.fci.rating },
    { label: 'Cost Per Student', value: metrics.costPerStudent != null ? `$${metrics.costPerStudent.toFixed(2)}` : 'N/A', sub: 'Per enrolled student' },
    { label: 'Preventive Maintenance', value: `${metrics.pmVsReactiveRatio.pmPct}%`, sub: `${metrics.pmVsReactiveRatio.pmCount} PM / ${metrics.pmVsReactiveRatio.reactiveCount} reactive` },
    { label: 'Deferred Backlog', value: `${metrics.deferredBacklog.count} tickets`, sub: `$${Math.round(metrics.deferredBacklog.estimatedCostUSD).toLocaleString()} est. cost` },
    { label: 'Avg Response Time', value: `${metrics.responseTime.avgHours.toFixed(1)}h`, sub: 'To first response' },
    { label: 'Avg Resolution Time', value: `${metrics.resolutionTime.avgHours.toFixed(1)}h`, sub: 'Ticket to completion' },
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

  addFooter(3)

  // ── Page 4: Compliance Status ────────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Compliance Status', marginL, 14)

  const domains = Object.entries(metrics.complianceStatus.byDomain)
  const headers = ['Domain', 'Current', 'Overdue', 'Total', '% Current']
  const colWidths = [55, 25, 25, 25, 30]
  let y4 = 28

  // Table header
  doc.setFillColor(17, 24, 39)
  doc.rect(marginL, y4, contentW, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  let x4 = marginL + 3
  headers.forEach((h, i) => {
    doc.text(h, x4, y4 + 5.5)
    x4 += colWidths[i]
  })
  y4 += 8

  domains.forEach(([domain, d], idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(marginL, y4, contentW, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    x4 = marginL + 3
    const row = [
      domain.replace(/_/g, ' '),
      String(d.current),
      String(d.overdue),
      String(d.total),
      `${d.pct}%`,
    ]
    row.forEach((cell, i) => {
      if (i === 4) {
        const pctColor: [number, number, number] =
          d.pct >= 80 ? [5, 150, 105] : d.pct >= 50 ? [245, 158, 11] : [239, 68, 68]
        doc.setTextColor(...pctColor)
      } else {
        doc.setTextColor(17, 24, 39)
      }
      doc.text(cell, x4, y4 + 5.5)
      x4 += colWidths[i]
    })
    y4 += 8
  })

  if (domains.length === 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(107, 114, 128)
    doc.text('No compliance records found.', marginL, y4 + 10)
  }

  addFooter(4)

  // ── Page 5: Asset Intelligence ───────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Asset Intelligence', marginL, 14)

  // EOL Forecast
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('End-of-Life Forecast', marginL, 30)

  const eolCards = [
    { label: 'Next 1 Year', count: metrics.assetEOLForecast.in1Year, cost: metrics.assetEOLForecast.totalReplacementCost1 },
    { label: 'Next 3 Years', count: metrics.assetEOLForecast.in3Years, cost: metrics.assetEOLForecast.totalReplacementCost3 },
    { label: 'Next 5 Years', count: metrics.assetEOLForecast.in5Years, cost: metrics.assetEOLForecast.totalReplacementCost5 },
  ]
  const eolColW = contentW / 3 - 4
  eolCards.forEach((card, i) => {
    const ex = marginL + i * (eolColW + 4)
    doc.setFillColor(240, 253, 250)
    doc.setDrawColor(167, 243, 208)
    doc.roundedRect(ex, 34, eolColW, 28, 3, 3, 'FD')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(card.label, ex + 5, 43)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(`${card.count} assets`, ex + 5, 53)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text(`$${Math.round(card.cost).toLocaleString()}`, ex + 5, 59)
  })

  // Top Repair Cost Assets table
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Top Repair Cost Assets', marginL, 80)

  const assetHeaders = ['#', 'Asset #', 'Name', 'Repair Cost', 'vs. Replacement']
  const assetColW = [10, 22, 70, 32, 36]
  let y5 = 85

  doc.setFillColor(17, 24, 39)
  doc.rect(marginL, y5, contentW, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  let x5 = marginL + 2
  assetHeaders.forEach((h, i) => {
    doc.text(h, x5, y5 + 5.5)
    x5 += assetColW[i]
  })
  y5 += 8

  metrics.topRepairCostAssets.slice(0, 10).forEach((asset, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(marginL, y5, contentW, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    x5 = marginL + 2
    const repPct = Math.round(asset.repairPct * 100)
    const row = [
      String(idx + 1),
      asset.assetNumber,
      asset.name.length > 30 ? asset.name.slice(0, 28) + '…' : asset.name,
      `$${Math.round(asset.cumulativeRepairCost).toLocaleString()}`,
      `${repPct}%${repPct >= 50 ? ' ⚠' : ''}`,
    ]
    row.forEach((cell, i) => {
      if (i === 4 && repPct >= 50) {
        doc.setTextColor(239, 68, 68)
      } else {
        doc.setTextColor(17, 24, 39)
      }
      doc.text(cell, x5, y5 + 5.5)
      x5 += assetColW[i]
    })
    y5 += 8
  })

  addFooter(5)

  // ── Page 6: Year-over-Year Comparison ───────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Year-over-Year Comparison', marginL, 14)

  const yoy = metrics.yoyComparison
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
      label: 'Total Cost',
      thisVal: `$${Math.round(yoy.thisYear.totalCost).toLocaleString()}`,
      lastVal: `$${Math.round(yoy.lastYear.totalCost).toLocaleString()}`,
      improved: yoy.thisYear.totalCost <= yoy.lastYear.totalCost,
      delta:
        yoy.lastYear.totalCost > 0
          ? Math.abs(
              Math.round(
                ((yoy.thisYear.totalCost - yoy.lastYear.totalCost) /
                  yoy.lastYear.totalCost) *
                  100
              )
            )
          : 0,
    },
    {
      label: 'Avg Resolution',
      thisVal: `${yoy.thisYear.avgResolutionHours.toFixed(1)}h`,
      lastVal: `${yoy.lastYear.avgResolutionHours.toFixed(1)}h`,
      improved: yoy.thisYear.avgResolutionHours <= yoy.lastYear.avgResolutionHours,
      delta:
        yoy.lastYear.avgResolutionHours > 0
          ? Math.abs(
              Math.round(
                ((yoy.thisYear.avgResolutionHours - yoy.lastYear.avgResolutionHours) /
                  yoy.lastYear.avgResolutionHours) *
                  100
              )
            )
          : 0,
    },
  ]

  const yoyColW = contentW / 3 - 4
  yoyCards.forEach((card, i) => {
    const ex = marginL + i * (yoyColW + 4)
    const bg: [number, number, number] = card.improved ? [240, 253, 250] : [254, 242, 242]
    const border: [number, number, number] = card.improved ? [167, 243, 208] : [252, 165, 165]
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

    const deltaColor: [number, number, number] = card.improved ? [5, 150, 105] : [239, 68, 68]
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...deltaColor)
    doc.text(
      `${card.improved ? '▼' : '▲'} ${card.delta}%`,
      ex + 5,
      72
    )
  })

  addFooter(6)

  return doc.output('arraybuffer')
}
