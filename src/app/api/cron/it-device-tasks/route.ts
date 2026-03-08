/**
 * POST /api/cron/it-device-tasks — scheduled device tasks (public, CRON_SECRET auth)
 * - Lemon detection across all orgs
 * - Overdue loaner notifications
 */
import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'
import { detectLemons } from '@/lib/services/itDeviceIntelligenceService'
import { getOverdue } from '@/lib/services/itLoanerService'
import { notifyITStaleTicket } from '@/lib/services/itNotificationService'

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
    }

    // Find all orgs with IT module enabled
    const enabledModules = await rawPrisma.tenantModule.findMany({
      where: { moduleId: 'it-helpdesk' },
      select: { organizationId: true },
    })
    const orgIds = enabledModules.map(m => m.organizationId)

    const results: { orgId: string; lemonsDetected: number; overdueCount: number; staleCount: number }[] = []

    for (const orgId of orgIds) {
      try {
        const lemonsDetected = await detectLemons(orgId)
        const overdue = await runWithOrgContext(orgId, () => getOverdue())

        // Stale ticket detection: BACKLOG tickets 48+ hours old, no assignment, not already notified
        const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000)
        const staleTickets = await rawPrisma.iTTicket.findMany({
          where: {
            organizationId: orgId,
            status: 'BACKLOG',
            assignedToId: null,
            deletedAt: null,
            createdAt: { lt: cutoff48h },
            OR: [
              { lastStaleNotifiedAt: null },
              { lastStaleNotifiedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // re-notify every 24h
            ],
          },
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            priority: true,
            issueType: true,
            submittedById: true,
          },
        })

        for (const stale of staleTickets) {
          await notifyITStaleTicket(stale as any, orgId)
          await rawPrisma.iTTicket.update({
            where: { id: stale.id },
            data: { lastStaleNotifiedAt: new Date() },
          })
        }

        results.push({ orgId, lemonsDetected, overdueCount: overdue.length, staleCount: staleTickets.length })
      } catch (err) {
        console.error(`[CRON it-device-tasks] Error for org ${orgId}:`, err)
        results.push({ orgId, lemonsDetected: 0, overdueCount: 0, staleCount: 0 })
      }
    }

    return NextResponse.json(ok({ processed: orgIds.length, results }))
  } catch (error) {
    console.error('[POST /api/cron/it-device-tasks]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Cron job failed'), { status: 500 })
  }
}
