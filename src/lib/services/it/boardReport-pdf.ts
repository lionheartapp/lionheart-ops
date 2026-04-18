/**
 * IT Board Report Service — PDF Export
 *
 * Generates professional PDF reports using jsPDF with cover pages,
 * metric cards, data tables, and bar charts for board presentations.
 */

import { jsPDF } from 'jspdf'
import { formatInTimezone } from '@/lib/utils/timezone'
import type {
  ITReportType,
  AnnualTechReportMetrics,
  RefreshForecastMetrics,
  RepairReplaceMetrics,
  DamageFeeCollectionMetrics,
} from './boardReport-types'

// ─── PDF Constants ───────────────────────────────────────────────────────────

const PAGE_W = 210
const PAGE_H = 297
const MARGIN_L = 20
const MARGIN_R = 20
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

// Blue accent colors (#3B82F6 blue-500)
const ACCENT_COLOR: [number, number, number] = [59, 130, 246]
const ACCENT_LIGHT: [number, number, number] = [239, 246, 255] // blue-50
const ACCENT_BORDER: [number, number, number] = [147, 197, 253] // blue-300

const REPORT_TITLES: Record<ITReportType, string> = {
  annual: 'Annual Technology Report',
  'refresh-forecast': 'Device Refresh Forecast',
  'repair-replace': 'Repair vs Replace Analysis',
  'damage-fees': 'Damage Fee Collection Report',
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

  const reportTitle = REPORT_TITLES[reportType]
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
    doc.text(`${orgName} — Lionheart IT Management`, MARGIN_L, PAGE_H - 8)
    doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN_R, PAGE_H - 8, {
      align: 'right',
    })
    doc.setDrawColor(220, 220, 220)
    doc.line(MARGIN_L, PAGE_H - 12, PAGE_W - MARGIN_R, PAGE_H - 12)
  }

  // ── Page 1: Cover ──────────────────────────────────────────────────────────
  doc.setFillColor(...ACCENT_COLOR)
  doc.rect(0, 0, PAGE_W, 60, 'F')

  doc.setFontSize(9)
  doc.setTextColor(191, 219, 254) // blue-200
  doc.setFont('helvetica', 'bold')
  doc.text('LIONHEART IT MANAGEMENT', MARGIN_L, 20)

  doc.setFontSize(22)
  doc.setTextColor(255, 255, 255)
  doc.text(reportTitle, MARGIN_L, 35)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text(orgName, MARGIN_L, 46)

  doc.setFontSize(10)
  doc.text(generatedStr, MARGIN_L, 54)

  // Cover stats box — varies by report type
  renderCoverStats(doc, reportType, metrics)

  addFooter(1)

  // ── Page 2: Executive Summary ─────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Executive Summary', MARGIN_L, 14)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(55, 65, 81)
  const narrativeLines = doc.splitTextToSize(narrative, CONTENT_W)
  doc.text(narrativeLines, MARGIN_L, 32)

  addFooter(2)

  // ── Data Pages (vary by report type) ──────────────────────────────────────
  if (reportType === 'annual') {
    renderAnnualDataPages(doc, metrics as unknown as AnnualTechReportMetrics, addFooter)
  } else if (reportType === 'refresh-forecast') {
    renderRefreshDataPages(doc, metrics as unknown as RefreshForecastMetrics, addFooter)
  } else if (reportType === 'repair-replace') {
    renderRepairReplaceDataPages(doc, metrics as unknown as RepairReplaceMetrics, addFooter)
  } else if (reportType === 'damage-fees') {
    renderDamageFeesDataPages(doc, metrics as unknown as DamageFeeCollectionMetrics, addFooter)
  }

  return doc.output('arraybuffer')
}

// ─── PDF Helpers ────────────────────────────────────────────────────────────

function renderCoverStats(
  doc: jsPDF,
  reportType: ITReportType,
  metrics: Record<string, unknown>,
) {
  if (reportType === 'annual') {
    const m = metrics as unknown as AnnualTechReportMetrics
    // Hero stat box
    doc.setFillColor(...ACCENT_COLOR)
    doc.roundedRect(MARGIN_L, 75, 80, 50, 4, 4, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL DEVICES', MARGIN_L + 8, 86)
    doc.setFontSize(36)
    doc.text(String(m.totalDevices ?? 0), MARGIN_L + 8, 108)
    doc.setFontSize(12)
    doc.text(`${m.activeDevices ?? 0} active`, MARGIN_L + 8, 118)

    // Side stats
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(MARGIN_L + 88, 75, CONTENT_W - 88, 50, 4, 4, 'F')
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
      doc.text(label, MARGIN_L + 92, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text(value, PAGE_W - MARGIN_R, y, { align: 'right' })
    })
  } else if (reportType === 'refresh-forecast') {
    const m = metrics as unknown as RefreshForecastMetrics
    doc.setFillColor(...ACCENT_LIGHT)
    doc.roundedRect(MARGIN_L, 75, CONTENT_W, 40, 4, 4, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(`Refresh Threshold: ${m.thresholdYears} years`, MARGIN_L + 8, 87)

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
      doc.text(label, MARGIN_L + 8, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text(value, PAGE_W - MARGIN_R - 8, y, { align: 'right' })
    })
  } else if (reportType === 'repair-replace') {
    const m = metrics as unknown as RepairReplaceMetrics
    doc.setFillColor(...ACCENT_LIGHT)
    doc.roundedRect(MARGIN_L, 75, CONTENT_W, 35, 4, 4, 'F')
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
      doc.text(label, MARGIN_L + 8, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text(value, PAGE_W - MARGIN_R - 8, y, { align: 'right' })
    })
  } else if (reportType === 'damage-fees') {
    const m = metrics as unknown as DamageFeeCollectionMetrics
    doc.setFillColor(...ACCENT_LIGHT)
    doc.roundedRect(MARGIN_L, 75, CONTENT_W, 35, 4, 4, 'F')
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
      doc.text(label, MARGIN_L + 8, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text(value, PAGE_W - MARGIN_R - 8, y, { align: 'right' })
    })
  }
}

// ─── Annual Report Data Pages ───────────────────────────────────────────────

function renderAnnualDataPages(
  doc: jsPDF,
  m: AnnualTechReportMetrics,
  addFooter: (n: number) => void
) {
  // ── Page 3: Key Metrics ─────────────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Key Metrics', MARGIN_L, 14)

  const col1X = MARGIN_L
  const col2X = PAGE_W / 2 + 5
  const colW = CONTENT_W / 2 - 5

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
  doc.text('Fleet Age Distribution', MARGIN_L, 120)

  const ageHeaders = ['Age Range', 'Device Count']
  const ageColW = [80, 80]
  let yAge = 126

  doc.setFillColor(17, 24, 39)
  doc.rect(MARGIN_L, yAge, CONTENT_W, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  let xAge = MARGIN_L + 3
  ageHeaders.forEach((h, i) => {
    doc.text(h, xAge, yAge + 5.5)
    xAge += ageColW[i]
  })
  yAge += 8

  ;(m.fleetAgeDistribution ?? []).forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(MARGIN_L, yAge, CONTENT_W, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    doc.text(row.range, MARGIN_L + 3, yAge + 5.5)
    doc.text(String(row.count), MARGIN_L + 3 + ageColW[0], yAge + 5.5)
    yAge += 8
  })

  // Top Issue Types
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Top Issue Types', MARGIN_L, yAge + 12)
  yAge += 18

  doc.setFillColor(17, 24, 39)
  doc.rect(MARGIN_L, yAge, CONTENT_W, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Issue Type', MARGIN_L + 3, yAge + 5.5)
  doc.text('Count', MARGIN_L + 3 + 80, yAge + 5.5)
  yAge += 8

  ;(m.topIssueTypes ?? []).forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(MARGIN_L, yAge, CONTENT_W, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    doc.text(row.issueType.replace(/_/g, ' '), MARGIN_L + 3, yAge + 5.5)
    doc.text(String(row.count), MARGIN_L + 3 + 80, yAge + 5.5)
    yAge += 8
  })

  addFooter(3)

  // ── Page 4: Year-over-Year Comparison ─────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Year-over-Year Comparison', MARGIN_L, 14)

  const yoy = m.yoyComparison
  if (yoy) {
    const yoyColW = CONTENT_W / 3 - 4
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
      const ex = MARGIN_L + i * (yoyColW + 4)
      const bg: [number, number, number] = card.improved ? ACCENT_LIGHT : [254, 242, 242]
      const border: [number, number, number] = card.improved ? ACCENT_BORDER : [252, 165, 165]
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
        ? ACCENT_COLOR
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
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Fleet Age & Issue Breakdown', MARGIN_L, 14)

  // Fleet age bar chart (simple horizontal bars)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Device Age Distribution', MARGIN_L, 30)

  const maxAgeCount = Math.max(
    ...(m.fleetAgeDistribution ?? []).map((d) => d.count),
    1
  )
  const barMaxW = CONTENT_W - 60

  ;(m.fleetAgeDistribution ?? []).forEach((row, i) => {
    const y = 38 + i * 14
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(55, 65, 81)
    doc.text(row.range, MARGIN_L, y + 4)

    const barW = Math.max((row.count / maxAgeCount) * barMaxW, 2)
    doc.setFillColor(...ACCENT_COLOR)
    doc.roundedRect(MARGIN_L + 50, y, barW, 8, 2, 2, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(17, 24, 39)
    doc.text(String(row.count), MARGIN_L + 52 + barW, y + 5.5)
  })

  addFooter(5)
}

// ─── Refresh Forecast Data Pages ────────────────────────────────────────────

function renderRefreshDataPages(
  doc: jsPDF,
  m: RefreshForecastMetrics,
  addFooter: (n: number) => void
) {
  // ── Page 3: Forecast Summary ──────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Refresh Forecast Details', MARGIN_L, 14)

  // Forecast cards
  const eolColW = CONTENT_W / 3 - 4
  const buckets = [
    { label: 'Year 1 (Immediate)', data: m.devicesDueIn1Year },
    { label: 'Year 2', data: m.devicesDueIn2Years },
    { label: 'Year 3', data: m.devicesDueIn3Years },
  ]

  buckets.forEach((bucket, i) => {
    const ex = MARGIN_L + i * (eolColW + 4)
    doc.setFillColor(...ACCENT_LIGHT)
    doc.setDrawColor(...ACCENT_BORDER)
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
  doc.text('Staggered Budget Recommendation', MARGIN_L, 72)

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
      doc.setFillColor(...ACCENT_LIGHT)
      doc.rect(MARGIN_L, yBudget, CONTENT_W, 8, 'F')
    } else if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(MARGIN_L, yBudget, CONTENT_W, 8, 'F')
    }
    doc.setFontSize(9)
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal')
    doc.setTextColor(17, 24, 39)
    doc.text(item.label, MARGIN_L + 3, yBudget + 5.5)
    doc.text(`$${Math.round(item.amount).toLocaleString()}`, PAGE_W - MARGIN_R - 3, yBudget + 5.5, {
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
    doc.text(`${bucket.label} — By Model`, MARGIN_L, yModel)
    yModel += 5

    doc.setFillColor(17, 24, 39)
    doc.rect(MARGIN_L, yModel, CONTENT_W, 8, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Model', MARGIN_L + 3, yModel + 5.5)
    doc.text('Count', MARGIN_L + 90, yModel + 5.5)
    doc.text('Est. Cost', MARGIN_L + 120, yModel + 5.5)
    yModel += 8

    bucket.data.models.slice(0, 8).forEach((row, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(249, 250, 251)
        doc.rect(MARGIN_L, yModel, CONTENT_W, 8, 'F')
      }
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(17, 24, 39)
      const modelName = row.model.length > 35 ? row.model.slice(0, 33) + '...' : row.model
      doc.text(modelName, MARGIN_L + 3, yModel + 5.5)
      doc.text(String(row.count), MARGIN_L + 90, yModel + 5.5)
      doc.text(`$${Math.round(row.estCost).toLocaleString()}`, MARGIN_L + 120, yModel + 5.5)
      yModel += 8
    })
    yModel += 8
  })

  addFooter(3)

  // ── Page 4: Additional model details if needed ────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Budget Planning Notes', MARGIN_L, 14)

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
    doc.text(`  •  ${note}`, MARGIN_L, 30 + i * 8)
  })

  addFooter(4)
}

// ─── Repair vs Replace Data Pages ───────────────────────────────────────────

function renderRepairReplaceDataPages(
  doc: jsPDF,
  m: RepairReplaceMetrics,
  addFooter: (n: number) => void
) {
  // ── Page 3: Device Table ──────────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Repair vs Replace Analysis', MARGIN_L, 14)

  // Summary cards
  const col3W = CONTENT_W / 3 - 4
  const summaryCards = [
    { label: 'Total Repair Cost', value: `$${Math.round(m.totalRepairCost).toLocaleString()}`, color: [239, 68, 68] as [number, number, number] },
    { label: 'Replacement Cost', value: `$${Math.round(m.totalReplacementCost).toLocaleString()}`, color: ACCENT_COLOR },
    { label: 'Net Savings', value: `$${Math.round(Math.abs(m.netSavings)).toLocaleString()}`, color: m.netSavings > 0 ? [5, 150, 105] as [number, number, number] : [239, 68, 68] as [number, number, number] },
  ]
  summaryCards.forEach((card, i) => {
    const ex = MARGIN_L + i * (col3W + 4)
    doc.setFillColor(...ACCENT_LIGHT)
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
  doc.rect(MARGIN_L, y3, CONTENT_W, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  let x3 = MARGIN_L + 2
  headers.forEach((h, i) => {
    doc.text(h, x3, y3 + 5.5)
    x3 += colWidths[i]
  })
  y3 += 8

  const maxDevices = Math.min(m.lemonDevices.length, 25) // Limit to fit on page
  m.lemonDevices.slice(0, maxDevices).forEach((device, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(MARGIN_L, y3, CONTENT_W, 8, 'F')
    }
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    x3 = MARGIN_L + 2
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
            : ACCENT_COLOR)
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
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Replacement Recommendations', MARGIN_L, 14)

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
    doc.text(note.startsWith('') && note.length === 0 ? '' : `  ${note}`, MARGIN_L, 30 + i * 7)
  })

  addFooter(4)
}

// ─── Damage Fees Data Pages ─────────────────────────────────────────────────

function renderDamageFeesDataPages(
  doc: jsPDF,
  m: DamageFeeCollectionMetrics,
  addFooter: (n: number) => void
) {
  // ── Page 3: Collection Summary ────────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Fee Collection Details', MARGIN_L, 14)

  // Summary cards
  const col4W = CONTENT_W / 4 - 3
  const feeCards = [
    { label: 'Assessed', value: `$${Math.round(m.totalAssessed).toLocaleString()}` },
    { label: 'Collected', value: `$${Math.round(m.totalPaid).toLocaleString()}` },
    { label: 'Outstanding', value: `$${Math.round(m.totalOutstanding).toLocaleString()}` },
    { label: 'Waived', value: `$${Math.round(m.totalWaived).toLocaleString()}` },
  ]
  feeCards.forEach((card, i) => {
    const ex = MARGIN_L + i * (col4W + 3)
    doc.setFillColor(...ACCENT_LIGHT)
    doc.setDrawColor(...ACCENT_BORDER)
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
  doc.text(`Collection Rate: ${collectionRate}%`, MARGIN_L, 62)

  // By Condition table
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Fees by Condition', MARGIN_L, 74)

  let yC = 80
  doc.setFillColor(17, 24, 39)
  doc.rect(MARGIN_L, yC, CONTENT_W, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Condition', MARGIN_L + 3, yC + 5.5)
  doc.text('Count', MARGIN_L + 60, yC + 5.5)
  doc.text('Total Fee', MARGIN_L + 100, yC + 5.5)
  yC += 8

  ;(m.byCondition ?? []).forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(MARGIN_L, yC, CONTENT_W, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    doc.text(row.condition, MARGIN_L + 3, yC + 5.5)
    doc.text(String(row.count), MARGIN_L + 60, yC + 5.5)
    doc.text(`$${Math.round(row.totalFee).toLocaleString()}`, MARGIN_L + 100, yC + 5.5)
    yC += 8
  })

  // Aging Buckets table
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Outstanding Fee Aging', MARGIN_L, yC + 12)
  yC += 18

  doc.setFillColor(17, 24, 39)
  doc.rect(MARGIN_L, yC, CONTENT_W, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Aging Bucket', MARGIN_L + 3, yC + 5.5)
  doc.text('Count', MARGIN_L + 60, yC + 5.5)
  doc.text('Amount', MARGIN_L + 100, yC + 5.5)
  yC += 8

  ;(m.agingBuckets ?? []).forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(MARGIN_L, yC, CONTENT_W, 8, 'F')
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

    doc.text(row.bucket, MARGIN_L + 3, yC + 5.5)
    doc.text(String(row.count), MARGIN_L + 60, yC + 5.5)
    doc.text(`$${Math.round(row.amount).toLocaleString()}`, MARGIN_L + 100, yC + 5.5)
    yC += 8
  })

  addFooter(3)

  // ── Page 4: By School Breakdown ───────────────────────────────────────────
  doc.addPage()
  doc.setFillColor(248, 250, 252)
  doc.rect(0, 0, PAGE_W, 22, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 24, 39)
  doc.text('Fee Collection by School', MARGIN_L, 14)

  let yS = 24
  doc.setFillColor(17, 24, 39)
  doc.rect(MARGIN_L, yS, CONTENT_W, 8, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('School', MARGIN_L + 3, yS + 5.5)
  doc.text('Assessed', MARGIN_L + 70, yS + 5.5)
  doc.text('Collected', MARGIN_L + 105, yS + 5.5)
  doc.text('Outstanding', MARGIN_L + 140, yS + 5.5)
  yS += 8

  ;(m.bySchool ?? []).forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251)
      doc.rect(MARGIN_L, yS, CONTENT_W, 8, 'F')
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(17, 24, 39)
    const schoolName = row.schoolName.length > 25
      ? row.schoolName.slice(0, 23) + '...'
      : row.schoolName
    doc.text(schoolName, MARGIN_L + 3, yS + 5.5)
    doc.text(`$${Math.round(row.assessed).toLocaleString()}`, MARGIN_L + 70, yS + 5.5)
    doc.text(`$${Math.round(row.paid).toLocaleString()}`, MARGIN_L + 105, yS + 5.5)

    // Highlight outstanding amounts > 0
    if (row.outstanding > 0) {
      doc.setTextColor(239, 68, 68)
    }
    doc.text(`$${Math.round(row.outstanding).toLocaleString()}`, MARGIN_L + 140, yS + 5.5)
    doc.setTextColor(17, 24, 39)
    yS += 8
  })

  if ((m.bySchool ?? []).length === 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(107, 114, 128)
    doc.text('No school-level fee data available.', MARGIN_L, yS + 10)
  }

  addFooter(4)
}
