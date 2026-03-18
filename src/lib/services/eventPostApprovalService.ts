/**
 * Post-Approval Automation Service
 *
 * Handles everything that should happen automatically when an EventProject
 * is fully approved and transitions to CONFIRMED:
 *
 * 1. Notify the event creator that their event was approved
 * 2. Send event invite emails to registered attendees
 * 3. Create in-app notifications for attendees
 * 4. Log the automation in the activity feed
 *
 * All operations are fire-and-forget to avoid blocking the approval response.
 */

import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import * as notificationService from '@/lib/services/notificationService'
import {
  sendEventApprovedEmail,
  sendEventInviteEmail,
} from '@/lib/services/emailService'
import { appendActivityLog } from '@/lib/services/eventProjectService'

const log = logger.child({ service: 'eventPostApprovalService' })

interface PostApprovalContext {
  eventProjectId: string
  approverId: string
}

/**
 * Run all post-approval automations for a confirmed EventProject.
 * This is fire-and-forget — errors are logged but never thrown.
 */
export async function runPostApprovalAutomations(ctx: PostApprovalContext): Promise<void> {
  const { eventProjectId, approverId } = ctx

  try {
    const project = await rawPrisma.eventProject.findUnique({
      where: { id: eventProjectId },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        organization: { select: { name: true, slug: true } },
        registrations: {
          where: { status: 'CONFIRMED' },
          include: {
            user: { select: { id: true, email: true, firstName: true } },
          },
        },
      },
    })

    if (!project) {
      log.warn({ eventProjectId }, 'Post-approval: project not found')
      return
    }

    const orgName = (project.organization as any)?.name || 'your school'
    const eventLink = `/events/${eventProjectId}`
    const eventTitle = project.title as string

    // ── 1. Notify creator that event was approved ──────────────────────
    await notifyCreator(project, orgName, eventLink)

    // ── 2. Notify registered attendees ─────────────────────────────────
    await notifyAttendees(project, orgName, eventLink)

    // ── 3. Log the automation ──────────────────────────────────────────
    await appendActivityLog(eventProjectId, approverId, 'POST_APPROVAL_AUTOMATION', {
      actions: ['creator_notified', 'attendees_notified'],
      attendeeCount: (project.registrations as any[])?.length || 0,
    })

    log.info({ eventProjectId, attendeeCount: (project.registrations as any[])?.length || 0 }, 'Post-approval automations completed')
  } catch (err) {
    log.error({ err, eventProjectId }, 'Post-approval automations failed (non-fatal)')
  }
}

/**
 * Notify the event creator that their event was approved.
 */
async function notifyCreator(project: any, orgName: string, eventLink: string): Promise<void> {
  const creator = project.createdBy
  if (!creator) return

  try {
    // In-app notification
    notificationService.createNotification({
      userId: creator.id,
      type: 'event_approved',
      title: `Your event "${project.title}" has been approved!`,
      body: 'All approval gates have been cleared. Your event is now confirmed and visible on the calendar.',
      linkUrl: eventLink,
    })

    // Email notification
    sendEventApprovedEmail({
      to: creator.email,
      eventTitle: project.title,
      channelName: 'all departments',
      orgName,
      eventLink,
    }).catch((err) => {
      log.error({ err, userId: creator.id }, 'Failed to send approval email to creator')
    })
  } catch (err) {
    log.error({ err }, 'Failed to notify creator')
  }
}

/**
 * Notify all registered attendees about the confirmed event.
 */
async function notifyAttendees(project: any, orgName: string, eventLink: string): Promise<void> {
  const registrations = project.registrations as any[] | undefined
  if (!registrations || registrations.length === 0) return

  const startsAt = project.startsAt ? new Date(project.startsAt) : null
  const eventDate = startsAt
    ? startsAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : undefined
  const eventTime = startsAt
    ? startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : undefined

  for (const reg of registrations) {
    const user = reg.user
    if (!user?.id) continue

    try {
      // In-app notification
      notificationService.createNotification({
        userId: user.id,
        type: 'event_invite',
        title: `"${project.title}" is confirmed!`,
        body: eventDate
          ? `The event is scheduled for ${eventDate}. Check the event page for full details.`
          : 'The event has been confirmed. Check the event page for details.',
        linkUrl: eventLink,
      })

      // Email invitation
      if (user.email) {
        sendEventInviteEmail({
          to: user.email,
          eventTitle: project.title,
          orgName,
          eventLink,
          eventDate,
          eventTime,
          eventId: project.id,
        }).catch((err) => {
          log.error({ err, userId: user.id }, 'Failed to send invite email to attendee')
        })
      }
    } catch (err) {
      log.error({ err, userId: user.id }, 'Failed to notify attendee')
    }
  }
}
