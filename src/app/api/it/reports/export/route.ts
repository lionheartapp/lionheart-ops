import { NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma } from '@/lib/db'
import { toOrgDateString } from '@/lib/utils/timezone'
import {
  getAnnualTechReport,
  getRefreshForecast,
  getRepairReplaceSummary,
  getDamageFeeCollection,
  generateITNarrative,
  exportITReportPDF,
} from '@/lib/services/itBoardReportService'

const REPORT_TITLES: Record<string, string> = {
  annual: 'Annual Technology Report',
  'refresh-forecast': 'Device Refresh Forecast',
  'repair-replace': 'Repair vs Replace Summary',
  'damage-fees': 'Damage Fee Collection Report',
}

export const POST = withAuth(async ({ req, orgId }) => {
  const body = await req.json()
  const { reportType, from, to, schoolId, thresholdYears } = body as {
    reportType: string
    from?: string
    to?: string
    schoolId?: string
    thresholdYears?: number
  }

  if (!reportType || !REPORT_TITLES[reportType]) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', `Invalid reportType. Must be one of: ${Object.keys(REPORT_TITLES).join(', ')}`),
      { status: 400 }
    )
  }

  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, timezone: true },
  })
  const orgName = org?.name ?? 'Organization'
  const orgTz = org?.timezone || 'America/Chicago'

  let metrics: Record<string, unknown>

  switch (reportType) {
    case 'annual': {
      const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1)
      const toDate = to ? new Date(to) : new Date()
      metrics = await getAnnualTechReport(orgId, { from: fromDate, to: toDate, schoolId }) as unknown as Record<string, unknown>
      break
    }
    case 'refresh-forecast': {
      metrics = await getRefreshForecast(orgId, { thresholdYears: thresholdYears ?? 4 }) as unknown as Record<string, unknown>
      break
    }
    case 'repair-replace': {
      metrics = await getRepairReplaceSummary(orgId) as unknown as Record<string, unknown>
      break
    }
    case 'damage-fees': {
      metrics = await getDamageFeeCollection(orgId, { schoolId }) as unknown as Record<string, unknown>
      break
    }
    default:
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid report type'), { status: 400 })
  }

  const narrative = await generateITNarrative(metrics, orgName, reportType)
  const pdfBuffer = await exportITReportPDF(reportType, metrics, narrative, orgName, orgTz)

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${reportType}-report-${toOrgDateString(new Date(), orgTz)}.pdf"`,
    },
  })
}, { permission: PERMISSIONS.IT_REPORTS_BOARD })
