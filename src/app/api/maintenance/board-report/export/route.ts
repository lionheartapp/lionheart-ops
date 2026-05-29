/**
 * POST /api/maintenance/board-report/export
 *
 * Generates a PDF board report with AI narrative and returns it as binary.
 * Permission: MAINTENANCE_VIEW_ANALYTICS
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
// eslint-disable-next-line no-restricted-imports -- Maintenance board export reads organization metadata by orgId after withAuth before generating the report.
import { rawPrisma } from '@/lib/db'
import {
  getBoardReportMetrics,
  generateAINarrative,
  exportBoardReportPDF,
} from '@/lib/services/boardReportService'

const BodySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  schoolId: z.string().optional(),
})

export const POST = withAuth(async ({ req, orgId }) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid JSON body'), { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues.map((e) => e.message)),
      { status: 400 }
    )
  }

  const { from, to, schoolId } = parsed.data
  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T23:59:59.999Z`)

  if (fromDate > toDate) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'from must be before to'),
      { status: 400 }
    )
  }

  // Fetch metrics and org name in parallel
  const [metrics, org] = await Promise.all([
    getBoardReportMetrics(orgId, { from: fromDate, to: toDate, campusId: schoolId }),
    rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
  ])

  const orgName = org?.name ?? 'School'

  // Generate AI narrative (may take 10-30 seconds)
  const narrative = await generateAINarrative(metrics, orgName)

  // Build PDF
  const pdfBuffer = await exportBoardReportPDF(orgId, orgName, metrics, narrative)

  // Filename: board-report-YYYY-MM.pdf
  const periodLabel = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}`
  const filename = `board-report-${periodLabel}.pdf`

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.byteLength),
    },
  })
}, { permission: PERMISSIONS.MAINTENANCE_VIEW_ANALYTICS })
