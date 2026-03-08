/**
 * IT Help Desk Notification Service
 *
 * Dispatches BOTH email (via emailService) and in-app notifications
 * (via notificationService) for IT ticket lifecycle triggers.
 *
 * ALL functions fire-and-forget — they never throw, never block.
 * The caller does NOT await these.
 */

import { rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { createNotification, createBulkNotifications } from '@/lib/services/notificationService'
import {
  sendITTicketSubmittedEmail,
  sendITTicketAssignedEmail,
  sendITTicketInProgressEmail,
  sendITTicketOnHoldEmail,
  sendITTicketDoneEmail,
  sendITTicketUrgentEmail,
} from '@/lib/services/emailService'

// ─── Types ───────────────────────────────────────────────────────────────────

type ITTicketSnapshot = {
  id: string
  ticketNumber: string
  title: string
  priority: string
  issueType: string
  organizationId?: string
  submittedById: string | null
  assignedToId?: string | null
  building?: { name: string } | null
  room?: { roomNumber?: string; displayName?: string | null } | null
  submittedBy?: { id: string; email: string; firstName: string | null; lastName: string | null } | null
  assignedTo?: { id: string; email: string; firstName: string | null; lastName: string | null } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
}

function ticketLink(): string {
  return `${getAppUrl()}/it?tab=tickets`
}

function issueTypeLabel(issueType: string): string {
  const labels: Record<string, string> = {
    HARDWARE: 'Hardware',
    SOFTWARE: 'Software',
    ACCOUNT_PASSWORD: 'Account / Password',
    NETWORK: 'Network',
    DISPLAY_AV: 'Display / A/V',
    OTHER: 'Other',
  }
  return labels[issueType] || issueType
}

function locationString(ticket: ITTicketSnapshot): string {
  const parts = [
    ticket.building?.name,
    ticket.room ? (ticket.room.displayName || ticket.room.roomNumber) : null,
  ].filter(Boolean)
  return parts.join(' > ') || 'Location not specified'
}

/**
 * Get all users in an org who have a specific permission.
 */
async function getUsersWithPermission(
  orgId: string,
  permission: string
): Promise<{ id: string; email: string; firstName: string; lastName: string }[]> {
  const parts = permission.split(':')
  const resource = parts[0] || ''
  const action = parts[1] || ''
  const scope = parts[2]

  const permWhere = scope
    ? [{ resource, action, scope }]
    : [{ resource, action, scope: 'global' }]

  const users = await rawPrisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      userRole: {
        permissions: {
          some: {
            permission: {
              OR: [
                { resource: '*', action: '*' }, // super-admin wildcard
                ...permWhere,
              ],
            },
          },
        },
      },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  })
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
  }))
}

// ─── Notification Triggers ────────────────────────────────────────────────────

/**
 * Ticket submitted — notify submitter (confirmation)
 */
export async function notifyITTicketSubmitted(ticket: ITTicketSnapshot, orgId: string): Promise<void> {
  try {
    if (!ticket.submittedById) return
    const link = ticketLink()
    const category = issueTypeLabel(ticket.issueType)

    // In-app notification to submitter
    await createNotification({
      userId: ticket.submittedById,
      type: 'it_ticket_submitted',
      title: `IT request ${ticket.ticketNumber} received`,
      body: `Your IT request "${ticket.title}" has been submitted successfully.`,
      linkUrl: link,
    })

    // Email to submitter
    if (ticket.submittedBy?.email) {
      sendITTicketSubmittedEmail({
        to: ticket.submittedBy.email,
        ticketNumber: ticket.ticketNumber,
        ticketTitle: ticket.title,
        category,
        ticketLink: link,
      }).catch((err) => console.error('[ITNotify] email it_ticket_submitted failed:', err))
    }
  } catch (err) {
    console.error('[ITNotify] notifyITTicketSubmitted failed:', err)
  }
}

/**
 * Ticket assigned — notify assignee
 */
export async function notifyITTicketAssigned(
  ticket: ITTicketSnapshot,
  assigneeId: string,
  orgId: string
): Promise<void> {
  try {
    const link = ticketLink()
    const category = issueTypeLabel(ticket.issueType)

    // Look up assignee
    const assignee = await rawPrisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, email: true, firstName: true, lastName: true },
    })
    if (!assignee) return

    // In-app
    await createNotification({
      userId: assigneeId,
      type: 'it_ticket_assigned',
      title: `IT ticket assigned: ${ticket.ticketNumber}`,
      body: `You've been assigned to "${ticket.title}". Priority: ${ticket.priority}.`,
      linkUrl: link,
    })

    // Email
    sendITTicketAssignedEmail({
      to: assignee.email,
      ticketNumber: ticket.ticketNumber,
      ticketTitle: ticket.title,
      priority: ticket.priority,
      category,
      ticketLink: link,
    }).catch((err) => console.error('[ITNotify] email it_ticket_assigned failed:', err))
  } catch (err) {
    console.error('[ITNotify] notifyITTicketAssigned failed:', err)
  }
}

/**
 * Status change — dispatches appropriate notification based on new status
 */
export async function notifyITStatusChange(
  ticket: ITTicketSnapshot,
  newStatus: string,
  orgId: string
): Promise<void> {
  try {
    if (!ticket.submittedById) return
    const link = ticketLink()

    switch (newStatus) {
      case 'IN_PROGRESS': {
        // Notify submitter
        await createNotification({
          userId: ticket.submittedById,
          type: 'it_ticket_in_progress',
          title: `Work started on ${ticket.ticketNumber}`,
          body: `Work has started on your IT request "${ticket.title}".`,
          linkUrl: link,
        })
        if (ticket.submittedBy?.email) {
          sendITTicketInProgressEmail({
            to: ticket.submittedBy.email,
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title,
            ticketLink: link,
          }).catch((err) => console.error('[ITNotify] email in_progress failed:', err))
        }
        break
      }

      case 'ON_HOLD': {
        // Notify submitter
        await createNotification({
          userId: ticket.submittedById,
          type: 'it_ticket_on_hold',
          title: `${ticket.ticketNumber} is on hold`,
          body: `Your IT request "${ticket.title}" is temporarily on hold.`,
          linkUrl: link,
        })
        if (ticket.submittedBy?.email) {
          sendITTicketOnHoldEmail({
            to: ticket.submittedBy.email,
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title,
            ticketLink: link,
          }).catch((err) => console.error('[ITNotify] email on_hold failed:', err))
        }
        break
      }

      case 'DONE': {
        // Notify submitter
        await createNotification({
          userId: ticket.submittedById,
          type: 'it_ticket_done',
          title: `${ticket.ticketNumber} resolved`,
          body: `Your IT request "${ticket.title}" has been resolved and closed.`,
          linkUrl: link,
        })
        if (ticket.submittedBy?.email) {
          sendITTicketDoneEmail({
            to: ticket.submittedBy.email,
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title,
            ticketLink: link,
          }).catch((err) => console.error('[ITNotify] email done failed:', err))
        }
        break
      }

      case 'CANCELLED': {
        // Notify submitter
        await createNotification({
          userId: ticket.submittedById,
          type: 'it_ticket_cancelled',
          title: `${ticket.ticketNumber} cancelled`,
          body: `Your IT request "${ticket.title}" has been cancelled.`,
          linkUrl: link,
        })
        // Also notify assignee if different from submitter
        if (ticket.assignedToId && ticket.assignedToId !== ticket.submittedById) {
          await createNotification({
            userId: ticket.assignedToId,
            type: 'it_ticket_cancelled',
            title: `${ticket.ticketNumber} cancelled`,
            body: `IT ticket "${ticket.title}" has been cancelled.`,
            linkUrl: link,
          })
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[ITNotify] notifyITStatusChange failed:', err)
  }
}

/**
 * Urgent ticket — notify all users with IT_TICKET_READ_ALL permission
 */
export async function notifyITUrgentTicket(ticket: ITTicketSnapshot, orgId: string): Promise<void> {
  try {
    const link = ticketLink()
    const category = issueTypeLabel(ticket.issueType)
    const coordinators = await getUsersWithPermission(orgId, PERMISSIONS.IT_TICKET_READ_ALL)
    if (coordinators.length === 0) return

    // In-app notifications
    await createBulkNotifications(
      coordinators.map((u) => ({
        userId: u.id,
        type: 'it_ticket_urgent' as const,
        title: `URGENT: ${ticket.ticketNumber}`,
        body: `Urgent IT request "${ticket.title}" requires immediate attention.`,
        linkUrl: link,
      }))
    )

    // Emails
    const location = locationString(ticket)
    for (const user of coordinators) {
      sendITTicketUrgentEmail({
        to: user.email,
        ticketNumber: ticket.ticketNumber,
        ticketTitle: ticket.title,
        category,
        location,
        ticketLink: link,
      }).catch((err) => console.error('[ITNotify] email it_ticket_urgent failed:', err))
    }
  } catch (err) {
    console.error('[ITNotify] notifyITUrgentTicket failed:', err)
  }
}

/**
 * Stale ticket — notify all IT coordinators about tickets in BACKLOG for 48+ hours with no assignment
 */
export async function notifyITStaleTicket(ticket: ITTicketSnapshot, orgId: string): Promise<void> {
  try {
    const coordinators = await getUsersWithPermission(orgId, PERMISSIONS.IT_TICKET_READ_ALL)
    if (coordinators.length === 0) return

    const link = `${getAppUrl()}/it?tab=board`

    await createBulkNotifications(
      coordinators.map((u) => ({
        userId: u.id,
        type: 'it_stale_ticket' as const,
        title: `Stale Ticket: ${ticket.ticketNumber}`,
        body: `"${ticket.title}" has been in the backlog for 48+ hours with no assignment.`,
        linkUrl: link,
      }))
    )
  } catch (e) {
    console.error('[notifyITStaleTicket]', e)
  }
}

/**
 * Comment added — notify the other party (submitter or assignee)
 */
export async function notifyITTicketComment(
  ticket: ITTicketSnapshot,
  commenterId: string,
  commentContent: string,
  orgId: string
): Promise<void> {
  try {
    if (!ticket.submittedById) return
    const link = ticketLink()

    // If commenter is the submitter, notify the assignee (if any)
    // If commenter is the coordinator/assignee, notify the submitter
    if (commenterId === ticket.submittedById && ticket.assignedToId) {
      await createNotification({
        userId: ticket.assignedToId,
        type: 'it_ticket_comment',
        title: `New comment on ${ticket.ticketNumber}`,
        body: `${ticket.submittedBy ? `${ticket.submittedBy.firstName ?? ''} ${ticket.submittedBy.lastName ?? ''}`.trim() || 'Submitter' : 'Submitter'} commented: "${commentContent.slice(0, 100)}"`,
        linkUrl: link,
      })
    } else if (commenterId !== ticket.submittedById) {
      await createNotification({
        userId: ticket.submittedById,
        type: 'it_ticket_comment',
        title: `New comment on ${ticket.ticketNumber}`,
        body: `An IT coordinator commented on your request "${ticket.title}".`,
        linkUrl: link,
      })
    }
  } catch (err) {
    console.error('[ITNotify] notifyITTicketComment failed:', err)
  }
}
