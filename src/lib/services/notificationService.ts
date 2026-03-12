import { prisma, rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'notificationService' })

// ─── Types ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'event_updated'
  | 'event_deleted'
  | 'event_invite'
  | 'event_approved'
  | 'event_rejected'
  | 'event_rsvp'
  // Maintenance ticket notifications (11 triggers)
  | 'maintenance_submitted'
  | 'maintenance_assigned'
  | 'maintenance_claimed'
  | 'maintenance_in_progress'
  | 'maintenance_on_hold'
  | 'maintenance_qa_ready'
  | 'maintenance_done'
  | 'maintenance_urgent'
  | 'maintenance_stale'
  | 'maintenance_qa_rejected'
  | 'maintenance_scheduled_released'
  // Maintenance asset intelligence alerts (3 triggers)
  | 'maintenance_repeat_repair'
  | 'maintenance_cost_threshold'
  | 'maintenance_end_of_life'
  // IT Help Desk ticket notifications (8 triggers)
  | 'it_ticket_submitted'
  | 'it_ticket_assigned'
  | 'it_ticket_in_progress'
  | 'it_ticket_on_hold'
  | 'it_ticket_done'
  | 'it_ticket_cancelled'
  | 'it_ticket_urgent'
  | 'it_ticket_comment'
  | 'it_stale_ticket'
  // Compliance reminders
  | 'compliance_reminder'
  // Security incidents
  | 'security_incident_created'
  | 'security_incident_escalated'
  | 'security_incident_status'
  | 'security_incident_closed'
  // Inventory alerts
  | 'inventory_low_stock'

/** Exported array of all valid notification type strings (for validation). */
export const NOTIFICATION_TYPES: NotificationType[] = [
  'event_updated', 'event_deleted', 'event_invite', 'event_approved', 'event_rejected', 'event_rsvp',
  'maintenance_submitted', 'maintenance_assigned', 'maintenance_claimed',
  'maintenance_in_progress', 'maintenance_on_hold', 'maintenance_qa_ready',
  'maintenance_done', 'maintenance_urgent', 'maintenance_stale', 'maintenance_qa_rejected',
  'maintenance_scheduled_released', 'maintenance_repeat_repair', 'maintenance_cost_threshold',
  'maintenance_end_of_life',
  'it_ticket_submitted', 'it_ticket_assigned', 'it_ticket_in_progress',
  'it_ticket_on_hold', 'it_ticket_done', 'it_ticket_cancelled',
  'it_ticket_urgent', 'it_ticket_comment', 'it_stale_ticket',
  'compliance_reminder',
  'security_incident_created', 'security_incident_escalated',
  'security_incident_status', 'security_incident_closed',
  'inventory_low_stock',
]

export interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body?: string
  linkUrl?: string
}

export interface CreateBulkNotificationInput {
  userId: string
  type: NotificationType
  title: string
  body?: string
  linkUrl?: string
}

// ─── Service ───────────────────────────────────────────────────────────

/** Create a single notification. Fire-and-forget — never throws. */
export async function createNotification(data: CreateNotificationInput) {
  try {
    // Check master pause and per-type in-app preference
    const [user, pref] = await Promise.all([
      rawPrisma.user.findUnique({
        where: { id: data.userId },
        select: { pauseAllNotifications: true },
      }),
      rawPrisma.notificationPreference.findUnique({
        where: { userId_type: { userId: data.userId, type: data.type } },
        select: { inAppEnabled: true },
      }),
    ])

    // If user has paused all notifications, skip entirely
    if (user?.pauseAllNotifications) return

    // If per-type in-app is explicitly disabled, skip
    if (pref && !pref.inAppEnabled) return

    await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body ?? null,
        linkUrl: data.linkUrl ?? null,
      } as any,
    })
  } catch (err) {
    log.error({ err }, 'Failed to create notification')
  }
}

/** Create notifications for multiple users. Fire-and-forget — never throws.
 *  Batch-checks pauseAllNotifications and per-type inAppEnabled preferences
 *  before persisting rows. Uses rawPrisma for lookups (NotificationPreference
 *  is not in the org-scoped whitelist per STATE.md decision).
 */
export async function createBulkNotifications(items: CreateBulkNotificationInput[]) {
  if (items.length === 0) return
  try {
    const userIds = [...new Set(items.map((i) => i.userId))]
    const types = [...new Set(items.map((i) => i.type))]

    // Batch-fetch paused users
    const users = await rawPrisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, pauseAllNotifications: true },
    })
    const pausedSet = new Set(
      users.filter((u) => u.pauseAllNotifications).map((u) => u.id)
    )

    // Batch-fetch explicitly disabled per-type in-app preferences
    const disabledPrefs = await rawPrisma.notificationPreference.findMany({
      where: {
        userId: { in: userIds },
        type: { in: types as any },
        inAppEnabled: false,
      },
      select: { userId: true, type: true },
    })
    const disabledSet = new Set(disabledPrefs.map((p) => `${p.userId}:${p.type}`))

    // Filter to only eligible recipients
    const eligible = items.filter(
      (item) =>
        !pausedSet.has(item.userId) &&
        !disabledSet.has(`${item.userId}:${item.type}`)
    )

    if (eligible.length === 0) return

    await prisma.notification.createMany({
      data: eligible.map((item) => ({
        userId: item.userId,
        type: item.type,
        title: item.title,
        body: item.body ?? null,
        linkUrl: item.linkUrl ?? null,
      })) as any,
    })
  } catch (err) {
    log.error({ err }, 'Failed to create bulk notifications')
  }
}

/** Get paginated notifications for a user, newest first. */
export async function getUserNotifications(
  userId: string,
  opts: { limit?: number; cursor?: string } = {}
) {
  const limit = opts.limit ?? 20
  const where = { userId }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(opts.cursor
      ? { cursor: { id: opts.cursor }, skip: 1 }
      : {}),
  })

  const hasMore = notifications.length > limit
  if (hasMore) notifications.pop()

  return {
    notifications,
    nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
  }
}

/** Get unread notification count for a user. */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  })
}

/** Mark a single notification as read. Validates ownership. */
export async function markAsRead(id: string, userId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true, readAt: new Date() },
  })
  return result.count > 0
}

/** Mark all unread notifications as read for a user. */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  })
  return result.count
}
