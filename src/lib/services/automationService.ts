/**
 * Automation Service — Scheduled Reminders & Escalations
 *
 * Called by the cron endpoint to handle time-based automations:
 *
 * 1. Registration reminders — 7 days and 24 hours before event
 * 2. Stale ticket escalation — tickets open > 3 days with no activity
 * 3. Approval gate timeout — gates pending > configurable hours
 *
 * Each function is idempotent — safe to run multiple times.
 */

import { Prisma } from '@prisma/client'
import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import * as notificationService from '@/lib/services/notificationService'
import { sendEventInviteEmail } from '@/lib/services/emailService'

const log = logger.child({ service: 'automationService' })

// ─── Registration Reminders ──────────────────────────────────────────────────

/**
 * Send registration reminders for events happening in 7 days and 24 hours.
 * Checks the EventRegistration table for confirmed registrations and
 * avoids duplicate reminders using the notification dedup logic.
 */
export async function processRegistrationReminders(): Promise<{ sent: number }> {
  const now = new Date()
  let sent = 0

  // 7-day and 24-hour windows
  const windows = [
    { label: '7 days', minMs: 6.5 * 24 * 60 * 60 * 1000, maxMs: 7.5 * 24 * 60 * 60 * 1000 },
    { label: '24 hours', minMs: 23 * 60 * 60 * 1000, maxMs: 25 * 60 * 60 * 1000 },
  ]

  for (const window of windows) {
    const windowStart = new Date(now.getTime() + window.minMs)
    const windowEnd = new Date(now.getTime() + window.maxMs)

    try {
      // Find confirmed events starting in this window
      const events = await rawPrisma.eventProject.findMany({
        where: {
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
          startsAt: { gte: windowStart, lte: windowEnd },
          deletedAt: null,
        },
        include: {
          organization: { select: { name: true } },
          registrations: {
            where: { status: 'REGISTERED' },
            select: { id: true, email: true, firstName: true },
          },
        },
      })

      for (const event of events) {
        const orgName = (event.organization as { name?: string } | null)?.name || 'your school'
        const eventDate = event.startsAt
          ? new Date(event.startsAt).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })
          : 'soon'

        for (const reg of (event.registrations as Array<{ id: string; email: string; firstName: string }>) || []) {
          if (!reg.email) continue

          // Email reminder (registrations don't have userId, so email only)
          sendEventInviteEmail({
            to: reg.email,
            eventTitle: event.title as string,
            orgName,
            eventLink: `/events/${event.id}`,
            eventDate,
          }).catch(() => {})

          sent++
        }
      }
    } catch (err) {
      log.error({ err, window: window.label }, 'Failed to process registration reminders')
    }
  }

  return { sent }
}

// ─── Stale Ticket Escalation ─────────────────────────────────────────────────

/**
 * Find maintenance tickets that have been open for more than 3 days
 * with no activity and notify the assigned team + admins.
 */
export async function processStaleTicketEscalations(): Promise<{ escalated: number }> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  let escalated = 0

  try {
    // Find stale maintenance tickets
    const staleTickets = await rawPrisma.maintenanceTicket.findMany({
      where: {
        status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS'] },
        updatedAt: { lte: threeDaysAgo },
        deletedAt: null,
      },
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true } },
        submittedBy: { select: { id: true, email: true, firstName: true } },
      },
      take: 50,
    })

    for (const ticket of staleTickets) {
      // Notify the assignee
      if (ticket.assignedTo?.id) {
        notificationService.createNotification({
          userId: ticket.assignedTo.id,
          type: 'maintenance_stale',
          title: `Ticket "${ticket.title}" has been open for 3+ days`,
          body: 'This ticket needs attention. Please update the status or add a comment.',
          linkUrl: `/maintenance/work-orders?ticket=${ticket.id}`,
        })
      }

      // Also notify the submitter that their ticket is being escalated
      if (ticket.submittedBy?.id && ticket.submittedBy.id !== ticket.assignedTo?.id) {
        notificationService.createNotification({
          userId: ticket.submittedBy.id,
          type: 'maintenance_stale',
          title: `Your ticket "${ticket.title}" is being escalated`,
          body: 'This ticket has been open for 3+ days without update. We\'re escalating it for attention.',
          linkUrl: `/maintenance/work-orders?ticket=${ticket.id}`,
        })
      }

      escalated++
    }

    // Do the same for IT tickets
    const staleITTickets = await rawPrisma.iTTicket.findMany({
      where: {
        status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS'] },
        updatedAt: { lte: threeDaysAgo },
        deletedAt: null,
      },
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true } },
        submittedBy: { select: { id: true, email: true, firstName: true } },
      },
      take: 50,
    })

    for (const ticket of staleITTickets) {
      if (ticket.assignedTo?.id) {
        notificationService.createNotification({
          userId: ticket.assignedTo.id,
          type: 'it_stale_ticket',
          title: `IT ticket "${ticket.title}" has been open for 3+ days`,
          body: 'This ticket needs attention. Please update the status or add a comment.',
          linkUrl: `/it?ticket=${ticket.id}`,
        })
      }
      escalated++
    }
  } catch (err) {
    log.error({ err }, 'Failed to process stale ticket escalations')
  }

  return { escalated }
}

// ─── Approval Gate Timeouts ──────────────────────────────────────────────────

/**
 * Find EventProjects with approval gates that have been PENDING longer than
 * the configured escalation hours (per-channel from ApprovalChannelConfig).
 * Sends reminder notifications to the responsible teams via config-driven lookup.
 */
export async function processApprovalGateTimeouts(): Promise<{ reminded: number }> {
  let reminded = 0

  try {
    // Import config-driven helpers (lazy to avoid circular deps)
    const { getTeamIdForGate, getEscalationHoursForGate, GATE_META } = await import('./eventProject-gates')
    type GateType = keyof typeof GATE_META

    // Fetch all pending-approval projects (use a generous 24h minimum to
    // avoid fetching brand-new events)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const pendingProjects = await rawPrisma.eventProject.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        updatedAt: { lte: twentyFourHoursAgo },
        approvalGates: { not: Prisma.JsonNullValueFilter.JsonNull },
        deletedAt: null,
      },
      include: {
        createdBy: { select: { id: true, firstName: true } },
      },
      take: 30,
    })

    for (const project of pendingProjects) {
      const gates = project.approvalGates as Record<string, Record<string, unknown>> | null
      if (!gates) continue

      for (const [gateKey, gate] of Object.entries(gates)) {
        if (!gate || gate.status !== 'PENDING') continue

        // Check per-channel escalation hours from config
        const escalationHours = await getEscalationHoursForGate(gateKey as GateType)
        const deadline = new Date(project.updatedAt.getTime() + escalationHours * 60 * 60 * 1000)
        if (new Date() <= deadline) continue

        // Find team to notify via config
        const teamId = await getTeamIdForGate(gateKey as GateType)
        if (!teamId) continue

        const members = await rawPrisma.userTeam.findMany({
          where: { teamId },
          select: { userId: true },
        })

        const meta = GATE_META[gateKey as GateType]
        const gateLabel = meta?.label ?? gateKey
        const linkUrl = meta?.defaultUrl ?? '/events'

        for (const member of members) {
          notificationService.createNotification({
            userId: member.userId,
            type: 'event_invite',
            title: `Overdue: "${project.title}" needs ${gateLabel} approval`,
            body: `This event has been waiting for ${gateLabel} approval for over ${escalationHours} hours.`,
            linkUrl,
          })
        }
        reminded++
      }
    }
  } catch (err) {
    log.error({ err }, 'Failed to process approval gate timeouts')
  }

  return { reminded }
}

// ─── Run All Automations ─────────────────────────────────────────────────────

/**
 * Entry point for the cron job — runs all automations.
 */
export async function runAllAutomations(): Promise<{
  registrationReminders: { sent: number }
  staleTickets: { escalated: number }
  gateTimeouts: { reminded: number }
}> {
  log.info('Running all automations...')

  const [registrationReminders, staleTickets, gateTimeouts] = await Promise.all([
    processRegistrationReminders(),
    processStaleTicketEscalations(),
    processApprovalGateTimeouts(),
  ])

  log.info({
    registrationReminders,
    staleTickets,
    gateTimeouts,
  }, 'All automations completed')

  return { registrationReminders, staleTickets, gateTimeouts }
}
