/**
 * GET /api/cron/board-report-delivery
 *
 * Secured by CRON_SECRET. Cross-org: uses rawPrisma.
 *
 * Query param: ?type=weekly|monthly
 * - weekly: last 7 days
 * - monthly: last 30 days
 *
 * For each org with maintenance module enabled:
 *   1. Finds users with MAINTENANCE_VIEW_ANALYTICS permission
 *   2. Generates board report PDF
 *   3. Sends email with PDF attached
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import {
  getBoardReportMetrics,
  generateAINarrative,
  exportBoardReportPDF,
} from '@/lib/services/boardReportService'
import { sendBoardReportEmail } from '@/lib/services/emailService'

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret) {
    console.error('[cron/board-report-delivery] CRON_SECRET not configured')
    return NextResponse.json(fail('CONFIGURATION_ERROR', 'Cron not configured'), { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const reportType = searchParams.get('type') === 'monthly' ? 'monthly' : 'weekly'

  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - (reportType === 'monthly' ? 30 : 7))
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)

  // Get all orgs with maintenance module enabled
  const orgsWithMaintenance = await rawPrisma.tenantModule.findMany({
    where: { moduleId: 'maintenance' },
    select: { organizationId: true },
  })

  let processedCount = 0

  for (const { organizationId } of orgsWithMaintenance) {
    try {
      // Find users with MAINTENANCE_VIEW_ANALYTICS permission
      // Permission string: 'maintenance:analytics:view'
      const permission = await rawPrisma.permission.findFirst({
        where: {
          resource: 'maintenance',
          action: 'analytics',
          scope: 'view',
        },
        select: { id: true },
      })

      if (!permission) continue

      // Find roles in this org that have the analytics permission
      const rolesWithPermission = await rawPrisma.rolePermission.findMany({
        where: { permissionId: permission.id },
        select: { roleId: true },
      })
      const roleIds = rolesWithPermission.map((r) => r.roleId)

      const recipients = await rawPrisma.user.findMany({
        where: {
          organizationId,
          deletedAt: null,
          status: 'ACTIVE',
          roleId: { in: roleIds },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      })

      if (recipients.length === 0) continue

      // Get org name
      const org = await rawPrisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      })
      const orgName = org?.name ?? 'School'

      // Generate metrics and PDF
      const metrics = await getBoardReportMetrics(organizationId, { from, to })
      const narrative = await generateAINarrative(metrics, orgName)
      const pdfBuffer = await exportBoardReportPDF(organizationId, orgName, metrics, narrative)

      const periodLabel =
        reportType === 'monthly'
          ? from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : `${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

      // Send to each eligible recipient
      for (const recipient of recipients) {
        try {
          await sendBoardReportEmail({
            to: recipient.email,
            recipientName: `${recipient.firstName ?? ''} ${recipient.lastName ?? ''}`.trim() || 'there',
            orgName,
            period: periodLabel,
            fciRating: metrics.fci.rating,
            backlogCount: metrics.deferredBacklog.count,
            pdfBuffer: Buffer.from(pdfBuffer),
          })
        } catch (recipientErr) {
          console.error(
            `[cron/board-report-delivery] Failed to send to ${recipient.email}:`,
            recipientErr
          )
        }
      }

      processedCount++
      console.log(
        `[cron/board-report-delivery] Processed org ${organizationId} (${orgName}) — ${recipients.length} recipients`
      )
    } catch (orgErr) {
      console.error(
        `[cron/board-report-delivery] Failed for org ${organizationId}:`,
        orgErr
      )
      // Non-fatal — continue with other orgs
    }
  }

  console.log(
    `[cron/board-report-delivery] Completed. Type: ${reportType}, Orgs processed: ${processedCount}`
  )
  return NextResponse.json(ok({ type: reportType, processed: processedCount }))
}
