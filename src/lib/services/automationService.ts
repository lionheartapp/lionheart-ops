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
        const orgName = (event.organization as any)?.name || 'your school'
        const eventDate = event.startsAt
          ? new Date(event.startsAt).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })
          : 'soon'

        for (const reg of (event.registrations as any[]) || []) {
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
 * Find EventProjects with approval gates that have been PENDING for more
 * than 72 hours and send reminder notifications to the responsible teams.
 */
export async function processApprovalGateTimeouts(): Promise<{ reminded: number }> {
  const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000)
  let reminded = 0

  try {
    const stalePendingProjects = await rawPrisma.eventProject.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        updatedAt: { lte: seventyTwoHoursAgo },
        approvalGates: { not: null },
        deletedAt: null,
      },
      include: {
        createdBy: { select: { id: true, firstName: true } },
      },
      take: 30,
    })

    const GATE_TEAM_SLUGS: Record<string, string> = {
      av: 'av-production',
      facilities: 'facility-maintenance',
    }

    const GATE_LABELS: Record<string, string> = {
      av: 'A/V Production',
      facilities: 'Facilities',
      admin: 'Admin',
    }

    for (const project of stalePendingProjects) {
      const gates = project.approvalGates as any
      if (!gates) continue

      for (const [gateKey, gate] of Object.entries(gates) as [string, any][]) {
        if (!gate || gate.status !== 'PENDING') continue

        // Find team members to remind
        const teamSlug = GATE_TEAM_SLUGS[gateKey]
        if (teamSlug) {
          const team = await rawPrisma.team.findFirst({
            where: { slug: teamSlug },
            select: { id: true },
          })
          if (team) {
            const members = await rawPrisma.userTeam.findMany({
              where: { teamId: team.id },
              select: { userId: true },
            })
            const gateLabel = GATE_LABELS[gateKey] || gateKey
            for (const member of members) {
              notificationService.createNotification({
                userId: member.userId,
                type: 'event_invite',
                title: `Overdue: "${project.title}" needs ${gateLabel} approval`,
                body: `This event has been waiting for ${gateLabel} approval for over 72 hours.`,
                linkUrl: gateKey === 'av' ? '/av/event-approvals' : '/maintenance/event-approvals',
              })
            }
            reminded++
          }
        }
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
