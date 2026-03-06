/**
 * GET /api/cron/maintenance-tasks — hourly cron job
 *
 * Secured by CRON_SECRET in Authorization header.
 * Runs across all organizations (no org context).
 *
 * Task 1: SCHEDULED → BACKLOG for tickets where scheduledDate <= now()
 * Task 2: 48h stale alert for BACKLOG tickets with no assignee that haven't been alerted yet
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import { notifyStaleTicket, notifyStatusChange } from '@/lib/services/maintenanceNotificationService'
import { generatePmTickets } from '@/lib/services/pmScheduleService'

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret) {
    console.error('[cron/maintenance-tasks] CRON_SECRET not configured')
    return NextResponse.json(fail('CONFIGURATION_ERROR', 'Cron not configured'), { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  const now = new Date()
  let releasedCount = 0
  let alertedCount = 0
  let pmCreatedCount = 0

  try {
    // ── Task 0: Generate PM tickets for due schedules ───────────────────────
    try {
      pmCreatedCount = await generatePmTickets()
      console.log(`[cron/maintenance-tasks] PM tickets generated: ${pmCreatedCount}`)
    } catch (pmErr) {
      console.error('[cron/maintenance-tasks] PM ticket generation failed:', pmErr)
      // Non-fatal — continue with other tasks
    }

    // ── Task 1: Release SCHEDULED tickets ──────────────────────────────────
    const scheduledTickets = await rawPrisma.maintenanceTicket.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: { lte: now },
        deletedAt: null,
      },
      include: {
        submittedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
        building: { select: { name: true } },
        area: { select: { name: true } },
        room: { select: { roomNumber: true, displayName: true } },
      },
    })

    for (const ticket of scheduledTickets) {
      try {
        await rawPrisma.maintenanceTicket.update({
          where: { id: ticket.id },
          data: {
            status: 'BACKLOG',
            version: { increment: 1 },
          },
        })

        await rawPrisma.maintenanceTicketActivity.create({
          data: {
            organizationId: ticket.organizationId,
            ticketId: ticket.id,
            actorId: ticket.submittedById,
            type: 'STATUS_CHANGE',
            fromStatus: 'SCHEDULED',
            toStatus: 'BACKLOG',
            content: 'Ticket auto-released from scheduled queue by system',
          },
        })

        // Fire-and-forget notification
        notifyStatusChange(
          {
            ...ticket,
            holdReason: ticket.holdReason ?? undefined,
            assignedToId: ticket.assignedToId ?? undefined,
            building: ticket.building ?? undefined,
            area: ticket.area ?? undefined,
            room: ticket.room ?? undefined,
            submittedBy: ticket.submittedBy
              ? {
                  email: ticket.submittedBy.email,
                  firstName: ticket.submittedBy.firstName ?? '',
                  lastName: ticket.submittedBy.lastName ?? '',
                }
              : undefined,
            assignedTo: ticket.assignedTo
              ? {
                  id: ticket.assignedTo.id,
                  email: ticket.assignedTo.email,
                  firstName: ticket.assignedTo.firstName ?? '',
                  lastName: ticket.assignedTo.lastName ?? '',
                }
              : undefined,
          },
          'SCHEDULED',
          ticket.organizationId
        ).catch((err) => console.error('[cron] notifyStatusChange failed:', err))

        releasedCount++
      } catch (err) {
        console.error(`[cron] Failed to release ticket ${ticket.id}:`, err)
      }
    }

    // ── Task 2: 48h stale ticket alerts ────────────────────────────────────
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

    const staleTickets = await rawPrisma.maintenanceTicket.findMany({
      where: {
        status: 'BACKLOG',
        assignedToId: null,
        staleAlertSent: false,
        createdAt: { lt: fortyEightHoursAgo },
        deletedAt: null,
      },
      include: {
        submittedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        building: { select: { name: true } },
        area: { select: { name: true } },
        room: { select: { roomNumber: true, displayName: true } },
      },
    })

    for (const ticket of staleTickets) {
      try {
        await rawPrisma.maintenanceTicket.update({
          where: { id: ticket.id },
          data: { staleAlertSent: true },
        })

        // Fire-and-forget notification
        notifyStaleTicket(
          {
            ...ticket,
            holdReason: ticket.holdReason ?? undefined,
            assignedToId: ticket.assignedToId ?? undefined,
            building: ticket.building ?? undefined,
            area: ticket.area ?? undefined,
            room: ticket.room ?? undefined,
            submittedBy: ticket.submittedBy
              ? {
                  email: ticket.submittedBy.email,
                  firstName: ticket.submittedBy.firstName ?? '',
                  lastName: ticket.submittedBy.lastName ?? '',
                }
              : undefined,
            assignedTo: undefined,
          },
          ticket.organizationId
        ).catch((err) => console.error('[cron] notifyStaleTicket failed:', err))

        alertedCount++
      } catch (err) {
        console.error(`[cron] Failed to alert stale ticket ${ticket.id}:`, err)
      }
    }

    console.log(`[cron/maintenance-tasks] Released: ${releasedCount}, Alerted: ${alertedCount}, PM tickets: ${pmCreatedCount}`)
    return NextResponse.json(ok({ released: releasedCount, alerted: alertedCount, pmCreated: pmCreatedCount }))
  } catch (error) {
    console.error('[cron/maintenance-tasks] Fatal error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Cron job failed'), { status: 500 })
  }
}
