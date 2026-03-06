/**
 * GET /api/maintenance/compliance/export
 *
 * Generate and return a PDF audit report of compliance records for a given date range.
 * Returns binary PDF with Content-Type: application/pdf.
 *
 * Query params:
 *   from=YYYY-MM-DD (required)
 *   to=YYYY-MM-DD   (required)
 *   schoolId=       (optional)
 *   domain=         (optional, ComplianceDomain enum value)
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { jsPDF } from 'jspdf'
import { fail } from '@/lib/api-response'
import { NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getComplianceRecordsForExport } from '@/lib/services/complianceService'
import { COMPLIANCE_DOMAIN_DEFAULTS, COMPLIANCE_DOMAINS } from '@/lib/types/compliance'
import { rawPrisma } from '@/lib/db'
import type { ComplianceDomain } from '@prisma/client'

const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  schoolId: z.string().optional(),
  domain: z.enum([
    'AHERA', 'FIRE_SAFETY', 'PLAYGROUND', 'LEAD_WATER', 'BOILER',
    'ELEVATOR', 'KITCHEN', 'ADA', 'RADON', 'IPM',
  ]).optional(),
})

const OUTCOME_LABELS: Record<string, string> = {
  PASSED: 'Passed',
  FAILED: 'Failed',
  CONDITIONAL_PASS: 'Conditional',
  PENDING: 'Pending',
}

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.COMPLIANCE_EXPORT)

    const { searchParams } = new URL(req.url)
    const query = QuerySchema.safeParse({
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      schoolId: searchParams.get('schoolId') || undefined,
      domain: searchParams.get('domain') || undefined,
    })
    if (!query.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'from and to date params are required (YYYY-MM-DD)'),
        { status: 400 }
      )
    }
    const { from: fromStr, to: toStr, schoolId, domain } = query.data

    return await runWithOrgContext(orgId, async () => {
      const fromDate = new Date(`${fromStr}T00:00:00Z`)
      const toDate = new Date(`${toStr}T23:59:59Z`)

      // Get org name
      const org = await rawPrisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      })
      const orgName = org?.name ?? 'Organization'

      // Fetch records
      const records = await getComplianceRecordsForExport(orgId, {
        from: fromDate,
        to: toDate,
        schoolId,
        domain: domain as ComplianceDomain | undefined,
      })

      // ─── Build PDF ───────────────────────────────────────────────────────────
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const margin = 15
      const contentW = pageW - margin * 2
      const generatedAt = new Date().toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
      const dateRange = `${new Date(fromStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(toStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

      // ─── Page 1: Header + Summary Table ─────────────────────────────────────
      let y = margin + 5

      // Header block
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('Compliance Audit Report', margin, y)
      y += 8

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(orgName, margin, y)
      y += 5
      doc.text(`Date Range: ${dateRange}`, margin, y)
      y += 5
      doc.text(`Generated: ${generatedAt}`, margin, y)
      y += 5
      if (domain) {
        doc.text(`Domain: ${COMPLIANCE_DOMAIN_DEFAULTS[domain as ComplianceDomain]?.label ?? domain}`, margin, y)
        y += 5
      }
      if (schoolId) {
        doc.text(`School ID: ${schoolId}`, margin, y)
        y += 5
      }
      y += 4

      // Divider line
      doc.setDrawColor(180, 180, 180)
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageW - margin, y)
      y += 6

      // Summary Table header
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('Summary by Domain', margin, y)
      y += 6

      // Table column widths for summary table
      const summaryColWidths = [55, 22, 22, 22, 50]
      const summaryHeaders = ['Domain', 'Records', 'Passed', 'Overdue/Failed', 'Last Inspection']

      // Draw table header
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setFillColor(245, 245, 245)
      doc.rect(margin, y, contentW, 6, 'F')

      let colX = margin + 2
      for (let i = 0; i < summaryHeaders.length; i++) {
        doc.text(summaryHeaders[i], colX, y + 4)
        colX += summaryColWidths[i]
      }
      y += 6

      // Summary rows (one per domain)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)

      const domainsToShow = domain ? [domain as ComplianceDomain] : COMPLIANCE_DOMAINS

      for (const dom of domainsToShow) {
        const domRecords = records.filter((r) => r.domain === dom)
        if (domRecords.length === 0) continue

        const passedCount = domRecords.filter((r) => r.outcome === 'PASSED').length
        const failedOrOverdue = domRecords.filter(
          (r) => r.outcome === 'FAILED' || r.status === 'OVERDUE'
        ).length
        const lastInspection = domRecords
          .filter((r) => r.inspectionDate)
          .sort((a, b) => new Date(b.inspectionDate!).getTime() - new Date(a.inspectionDate!).getTime())[0]
        const lastInspectionStr = lastInspection?.inspectionDate
          ? new Date(lastInspection.inspectionDate).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })
          : '—'

        const rowData = [
          COMPLIANCE_DOMAIN_DEFAULTS[dom]?.label ?? dom,
          String(domRecords.length),
          String(passedCount),
          String(failedOrOverdue),
          lastInspectionStr,
        ]

        if (y > pageH - margin - 10) {
          doc.addPage()
          y = margin + 5
        }

        colX = margin + 2
        for (let i = 0; i < rowData.length; i++) {
          const cellText = doc.splitTextToSize(rowData[i], summaryColWidths[i] - 4)
          doc.text(cellText, colX, y + 4)
          colX += summaryColWidths[i]
        }

        // Row divider
        doc.setDrawColor(230, 230, 230)
        doc.line(margin, y + 6, pageW - margin, y + 6)
        y += 7
      }

      y += 6

      // ─── Detail section: per domain ──────────────────────────────────────────
      for (const dom of domainsToShow) {
        const domRecords = records.filter((r) => r.domain === dom)
        if (domRecords.length === 0) continue

        if (y > pageH - margin - 20) {
          doc.addPage()
          y = margin + 5
        }

        // Section header
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setFillColor(240, 253, 244) // light emerald
        doc.rect(margin, y, contentW, 7, 'F')
        doc.text(COMPLIANCE_DOMAIN_DEFAULTS[dom]?.label ?? dom, margin + 2, y + 5)
        y += 10

        // Detail table header
        const detailColWidths = [50, 25, 30, 24, 30, 18]
        const detailHeaders = ['Title', 'Due Date', 'Inspection Date', 'Outcome', 'Inspector', 'Docs']

        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setFillColor(248, 248, 248)
        doc.rect(margin, y, contentW, 6, 'F')

        colX = margin + 2
        for (let i = 0; i < detailHeaders.length; i++) {
          doc.text(detailHeaders[i], colX, y + 4)
          colX += detailColWidths[i]
        }
        y += 6

        // Detail rows
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)

        for (const record of domRecords) {
          if (y > pageH - margin - 10) {
            doc.addPage()
            y = margin + 5
          }

          const rowData = [
            record.title,
            new Date(record.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            record.inspectionDate
              ? new Date(record.inspectionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—',
            OUTCOME_LABELS[record.outcome] ?? record.outcome,
            record.inspector ?? '—',
            String(record.attachments?.length ?? 0),
          ]

          colX = margin + 2
          for (let i = 0; i < rowData.length; i++) {
            const cellText = doc.splitTextToSize(rowData[i], detailColWidths[i] - 4)
            doc.text(cellText[0] ?? '', colX, y + 4)
            colX += detailColWidths[i]
          }

          // Row divider
          doc.setDrawColor(235, 235, 235)
          doc.line(margin, y + 6, pageW - margin, y + 6)
          y += 7
        }

        y += 4
      }

      // ─── Footer on all pages ──────────────────────────────────────────────────
      const totalPages = doc.getNumberOfPages()
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        doc.setPage(pageNum)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(150, 150, 150)
        const footerText = `Generated by Lionheart Facilities Management — Page ${pageNum} of ${totalPages}`
        doc.text(footerText, margin, pageH - 8)
        doc.setTextColor(0, 0, 0) // reset
      }

      // ─── Output ──────────────────────────────────────────────────────────────
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
      const today = new Date().toISOString().split('T')[0]

      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="compliance-audit-${today}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      })
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError' || error.message.includes('required')) {
        return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
      }
    }
    console.error('[GET /api/maintenance/compliance/export]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
