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
import { runRepeatRepairDetection } from '@/lib/services/repeatRepairService'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Missing cron secret'), { status: 401 })
  }

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    logger.error('CRON_SECRET not configured')
    return NextResponse.json(fail('CONFIGURATION_ERROR', 'Cron not configured'), { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  const now = new Date()
  let releasedCount = 0
  let alertedCount = 0
  let pmCreatedCount = 0
  let repairDetectedCount = 0

  try {
    // ── Task 0: Generate PM tickets for due schedules ───────────────────────
    try {
      pmCreatedCount = await generatePmTickets()
      logger.info({ pmCreatedCount }, 'PM tickets generated')
    } catch (pmErr) {
      logger.error({ error: String(pmErr) }, 'PM ticket generation failed')
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
        space: { select: { name: true } },
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
            space: ticket.space ?? undefined,
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
        ).catch((err) => logger.error({ error: String(err) }, 'notifyStatusChange failed'))

        releasedCount++
      } catch (err) {
        logger.error({ error: String(err), ticketId: ticket.id }, 'Failed to release ticket')
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
        space: { select: { name: true } },
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
            space: ticket.space ?? undefined,
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
        ).catch((err) => logger.error({ error: String(err) }, 'notifyStaleTicket failed'))

        alertedCount++
      } catch (err) {
        logger.error({ error: String(err), ticketId: ticket.id }, 'Failed to alert stale ticket')
      }
    }

    // ── Task 3: Repeat repair detection ────────────────────────────────────────
    try {
      // Get distinct org IDs that have the maintenance module enabled
      // TenantModule existence = enabled; uses moduleId field
      const orgsWithMaintenance = await rawPrisma.tenantModule.findMany({
        where: { moduleId: 'maintenance' },
        select: { organizationId: true },
      })
      for (const { organizationId } of orgsWithMaintenance) {
        try {
          const result = await runRepeatRepairDetection(organizationId)
          repairDetectedCount += result.repeatRepair + result.costThreshold + result.endOfLife
        } catch (orgErr) {
          logger.error({ error: String(orgErr), organizationId }, 'Repair detection failed for org')
        }
      }
      logger.info({ repairDetectedCount }, 'Repair detections triggered')
    } catch (repairErr) {
      logger.error({ error: String(repairErr) }, 'Repair detection task failed')
    }

    // ── Task 4: Escalation rules ────────────────────────────────────────────
    let escalatedCount = 0
    try {
      const escalationRules = await rawPrisma.escalationRule.findMany({
        where: { isActive: true, module: 'MAINTENANCE' },
      })

      for (const rule of escalationRules) {
        const cutoff = new Date(now.getTime() - rule.triggerMins * 60_000)
        const unrespondedTickets = await rawPrisma.maintenanceTicket.findMany({
          where: {
            organizationId: rule.organizationId,
            firstResponseAt: null,
            createdAt: { lte: cutoff },
            status: { notIn: ['DONE', 'CANCELLED'] },
            deletedAt: null,
          },
          select: { id: true, priority: true },
          take: 50,
        })

        for (const ticket of unrespondedTickets) {
          try {
            if (rule.action === 'BUMP_PRIORITY' && rule.targetPriority) {
              await rawPrisma.maintenanceTicket.update({
                where: { id: ticket.id },
                data: { priority: rule.targetPriority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' },
              })
              escalatedCount++
            } else if (rule.action === 'REASSIGN' && rule.targetUserId) {
              await rawPrisma.maintenanceTicket.update({
                where: { id: ticket.id },
                data: { assignedToId: rule.targetUserId, firstResponseAt: now },
              })
              escalatedCount++
            }
            // NOTIFY_ADMIN handled by existing stale alert mechanism
          } catch (ticketErr) {
            logger.error({ error: String(ticketErr), ticketId: ticket.id }, 'Escalation failed for ticket')
          }
        }
      }
      if (escalatedCount > 0) logger.info({ escalatedCount }, 'Escalation rules applied')
    } catch (escErr) {
      logger.error({ error: String(escErr) }, 'Escalation task failed')
    }

    logger.info({ releasedCount, alertedCount, pmCreatedCount, repairDetectedCount, escalatedCount }, 'Maintenance tasks completed')
    return NextResponse.json(ok({ released: releasedCount, alerted: alertedCount, pmCreated: pmCreatedCount, repairDetected: repairDetectedCount, escalated: escalatedCount }))
  } catch (error) {
    logger.error({ error: String(error) }, 'Fatal error')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Cron job failed'), { status: 500 })
  }
}
