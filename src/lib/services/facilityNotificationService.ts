/**
 * Facility Booking Notification Service
 *
 * Handles push + email notifications for booking confirmations, overrides,
 * cancellations, and maintenance blocks.
 */

import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { getOrgContextId } from '@/lib/org-context'
import { createNotification, createBulkNotifications } from '@/lib/services/notificationService'

// ─── Override Notification ──────────────────────────────────────────────────

/**
 * Notify the original booker when their booking is overridden.
 * Sends push notification + creates in-app notification.
 * The notification includes the override reason and a link to DM the admin.
 */
export async function notifyBookingOverride(opts: {
  overriddenEventId: string
  overridingUserId: string
  overridingUserName: string
  reason: string
  newEventTitle: string
}): Promise<void> {
  try {
    const orgId = getOrgContextId()
    if (!orgId) return

    // Look up the overridden event to find who created it
    const overriddenEvent = await prisma.calendarEvent.findUnique({
      where: { id: opts.overriddenEventId },
      select: {
        title: true,
        startTime: true,
        createdById: true,
        space: { select: { name: true } },
      },
    })

    if (!overriddenEvent?.createdById) return

    const dateStr = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(overriddenEvent.startTime)

    const spaceName = overriddenEvent.space?.name ?? 'a shared space'
    const message = `${opts.overridingUserName} booked "${opts.newEventTitle}" at ${spaceName} on ${dateStr}, overlapping your "${overriddenEvent.title}." Reason: ${opts.reason}`

    await createNotification({
      userId: overriddenEvent.createdById,
      type: 'facility_override',
      title: 'Booking Override',
      body: message,
      linkUrl: `/messaging?dmWith=${opts.overridingUserId}`,
    })
  } catch {
    // Fire-and-forget — don't break the booking flow
  }
}

// ─── Cancellation Notification ──────────────────────────────────────────────

/**
 * Notify team members when a practice/event is cancelled.
 */
export async function notifyCancellation(opts: {
  eventTitle: string
  date: Date
  reason: string
  teamId?: string
  cancelledByName: string
}): Promise<void> {
  try {
    const orgId = getOrgContextId()
    if (!orgId) return

    const dateStr = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(opts.date)

    const reasonLabel = opts.reason === 'weather' ? 'Weather'
      : opts.reason === 'field_condition' ? 'Field condition'
      : opts.reason === 'scheduling_change' ? 'Scheduling change'
      : opts.reason

    const message = `${opts.eventTitle} on ${dateStr} has been cancelled. Reason: ${reasonLabel}`

    // If we have a team, notify all roster members
    // For now, just create a general notification for the org
    // TODO: Once athlete→user mapping is in place, target specific team members
    if (opts.teamId) {
      // Get team's coach
      const team = await prisma.athleticTeam.findUnique({
        where: { id: opts.teamId },
        select: { coachUserId: true },
      })
      if (team?.coachUserId) {
        await createNotification({
          userId: team.coachUserId,
          type: 'facility_cancellation',
          title: 'Practice Cancelled',
          body: message,
          linkUrl: '/calendar',
        })
      }
    }
  } catch {
    // Fire-and-forget
  }
}

// ─── Maintenance Block Notification ─────────────────────────────────────────

/**
 * Notify users with bookings on a space that it's been blocked for maintenance.
 * Only notifies for bookings in the next 30 days. Batches per user.
 */
export async function notifyMaintenanceBlock(opts: {
  spaceId: string
  spaceName: string
  blockedByName: string
}): Promise<void> {
  try {
    const orgId = getOrgContextId()
    if (!orgId) return

    const now = new Date()
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Find all confirmed bookings on this space in the next 30 days
    const affectedEvents = await prisma.calendarEvent.findMany({
      where: {
        spaceId: opts.spaceId,
        startTime: { gte: now, lte: thirtyDaysOut },
        calendarStatus: { in: ['CONFIRMED', 'PENDING_APPROVAL'] },
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        createdById: true,
      },
    })

    if (affectedEvents.length === 0) return

    // Group by user (batch per recipient)
    const byUser = new Map<string, typeof affectedEvents>()
    for (const event of affectedEvents) {
      if (!event.createdById) continue
      const existing = byUser.get(event.createdById) ?? []
      existing.push(event)
      byUser.set(event.createdById, existing)
    }

    // Send one notification per affected user
    const notifications = Array.from(byUser.entries()).map(([userId, events]) => {
      const count = events.length
      const firstDate = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(events[0].startTime)

      const body = count === 1
        ? `${opts.spaceName} is now under maintenance. Your booking "${events[0].title}" on ${firstDate} may be affected.`
        : `${opts.spaceName} is now under maintenance. ${count} of your bookings in the next 30 days may be affected.`

      return {
        userId,
        type: 'facility_maintenance_block' as const,
        title: 'Space Under Maintenance',
        body,
        linkUrl: '/calendar',
      }
    })

    if (notifications.length > 0) {
      await createBulkNotifications(notifications)
    }
  } catch {
    // Fire-and-forget
  }
}
