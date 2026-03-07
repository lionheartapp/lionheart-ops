import { prisma } from '@/lib/db'

// ─── Types ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'event_updated'
  | 'event_deleted'
  | 'event_invite'
  | 'event_approved'
  | 'event_rejected'
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
  // Compliance reminders
  | 'compliance_reminder'

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
    console.error('Failed to create notification:', err)
  }
}

/** Create notifications for multiple users. Fire-and-forget — never throws. */
export async function createBulkNotifications(items: CreateBulkNotificationInput[]) {
  if (items.length === 0) return
  try {
    await prisma.notification.createMany({
      data: items.map((item) => ({
        userId: item.userId,
        type: item.type,
        title: item.title,
        body: item.body ?? null,
        linkUrl: item.linkUrl ?? null,
      })) as any,
    })
  } catch (err) {
    console.error('Failed to create bulk notifications:', err)
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
