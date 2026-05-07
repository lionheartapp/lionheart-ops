import { createNotification } from '@/lib/services/notificationService'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'taskNotification' })

/**
 * Fire-and-forget notification when an event task is assigned to a user.
 * Called from event task create/update routes when assigneeId is set or changed.
 */
export async function notifyTaskAssigned({
  assigneeId,
  assignerName,
  taskTitle,
  eventTitle,
}: {
  assigneeId: string
  assignerName: string
  taskTitle: string
  eventTitle: string
}): Promise<void> {
  try {
    await createNotification({
      userId: assigneeId,
      type: 'task_assigned',
      title: `New task: "${taskTitle}"`,
      body: `${assignerName} assigned you a task on ${eventTitle}.`,
      linkUrl: '/dashboard?openTasks=true',
    })
  } catch (err) {
    log.error({ err }, 'Failed to send task_assigned notification')
  }
}

/**
 * Fire-and-forget notification when a task's due date is approaching.
 * Intended to be called from a cron job or background check.
 */
export async function notifyTaskDueSoon({
  userId,
  taskTitle,
  dueDate,
  isPersonal,
}: {
  userId: string
  taskTitle: string
  dueDate: Date
  isPersonal: boolean
}): Promise<void> {
  try {
    const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const timeLabel = daysUntil <= 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`
    await createNotification({
      userId,
      type: 'task_due_soon',
      title: `Task due ${timeLabel}: "${taskTitle}"`,
      body: isPersonal ? 'Personal task reminder.' : 'Event task reminder.',
      linkUrl: '/dashboard?openTasks=true',
    })
  } catch (err) {
    log.error({ err }, 'Failed to send task_due_soon notification')
  }
}
