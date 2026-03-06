/**
 * Maintenance Notification Service
 *
 * Thin wrapper that dispatches BOTH email (via emailService) and in-app
 * notifications (via notificationService) for each of the 11 maintenance
 * notification triggers.
 *
 * ALL functions fire-and-forget — they never throw, never block.
 * The caller does NOT await these.
 */

import { rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { createNotification, createBulkNotifications } from '@/lib/services/notificationService'
import {
  sendMaintenanceSubmittedEmail,
  sendMaintenanceAssignedEmail,
  sendMaintenanceClaimedEmail,
  sendMaintenanceInProgressEmail,
  sendMaintenanceOnHoldEmail,
  sendMaintenanceQAReadyEmail,
  sendMaintenanceDoneEmail,
  sendMaintenanceUrgentEmail,
  sendMaintenanceStaleEmail,
  sendMaintenanceQARejectedEmail,
} from '@/lib/services/emailService'
import { matchesPermission } from '@/lib/permissions'

// ─── Types ───────────────────────────────────────────────────────────────────

type TicketSnapshot = {
  id: string
  ticketNumber: string
  title: string
  priority: string
  category: string
  specialty: string
  holdReason?: string | null
  organizationId: string
  submittedById: string
  assignedToId?: string | null
  building?: { name: string } | null
  area?: { name: string } | null
  room?: { name: string; code?: string | null } | null
  submittedBy?: { email: string; firstName: string; lastName: string } | null
  assignedTo?: { id: string; email?: string; firstName: string; lastName: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
}

function ticketLink(ticketId: string): string {
  return `${getAppUrl()}/maintenance/tickets/${ticketId}`
}

function locationString(ticket: TicketSnapshot): string {
  const parts = [
    ticket.building?.name,
    ticket.area?.name,
    ticket.room ? `${ticket.room.name}${ticket.room.code ? ` (${ticket.room.code})` : ''}` : null,
  ].filter(Boolean)
  return parts.join(' > ') || 'Location not specified'
}

/**
 * Get all users in an org who have a specific permission.
 * Uses rawPrisma to bypass org scoping.
 */
async function getUsersWithPermission(orgId: string, permission: string): Promise<{ id: string; email: string; firstName: string; lastName: string }[]> {
  // Find users whose role has this permission
  const users = await rawPrisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      userRole: {
        permissions: {
          some: {
            permission: {
              // Match the permission string pattern
              OR: [
                { resource: '*', action: '*' }, // super-admin wildcard
                ...permissionToWhere(permission),
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

/**
 * Convert a permission string like "maintenance:read:all" into Prisma where clauses.
 */
function permissionToWhere(perm: string): Array<{ resource: string; action: string; scope?: string }> {
  const parts = perm.split(':')
  const resource = parts[0] || ''
  const action = parts[1] || ''
  const scope = parts[2]

  if (scope) {
    return [{ resource, action, scope }]
  }
  return [{ resource, action, scope: 'global' }]
}

/**
 * Get head-of-maintenance users (role slug 'maintenance-head') in an org.
 * Falls back to users with MAINTENANCE_APPROVE_QA permission.
 */
async function getMaintenanceHeads(orgId: string): Promise<{ id: string; email: string; firstName: string; lastName: string }[]> {
  // Try by role slug first
  const byRoleRaw = await rawPrisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      userRole: { slug: 'maintenance-head' },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  })
  const byRole = byRoleRaw.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
  }))

  if (byRole.length > 0) return byRole

  // Fallback: users with MAINTENANCE_APPROVE_QA permission
  return getUsersWithPermission(orgId, PERMISSIONS.MAINTENANCE_APPROVE_QA)
}

// ─── Notification Triggers ────────────────────────────────────────────────────

/**
 * NOTIF-01: Ticket submitted — notify submitter (confirmation)
 */
export async function notifyTicketSubmitted(ticket: TicketSnapshot, orgId: string): Promise<void> {
  try {
    const link = ticketLink(ticket.id)

    // In-app notification to submitter
    await createNotification({
      userId: ticket.submittedById,
      type: 'maintenance_submitted',
      title: `Request ${ticket.ticketNumber} received`,
      body: `Your maintenance request "${ticket.title}" has been submitted successfully.`,
      linkUrl: link,
    })

    // Email to submitter
    if (ticket.submittedBy?.email) {
      sendMaintenanceSubmittedEmail({
        to: ticket.submittedBy.email,
        ticketNumber: ticket.ticketNumber,
        ticketTitle: ticket.title,
        priority: ticket.priority,
        category: ticket.category,
        ticketLink: link,
      }).catch((err) => console.error('[MaintenanceNotify] email maintenance_submitted failed:', err))
    }
  } catch (err) {
    console.error('[MaintenanceNotify] notifyTicketSubmitted failed:', err)
  }
}

/**
 * NOTIF-05: Urgent ticket — notify all users with MAINTENANCE_READ_ALL permission
 */
export async function notifyUrgentTicket(ticket: TicketSnapshot, orgId: string): Promise<void> {
  try {
    const link = ticketLink(ticket.id)
    const heads = await getMaintenanceHeads(orgId)
    if (heads.length === 0) return

    // In-app notifications
    await createBulkNotifications(
      heads.map((u) => ({
        userId: u.id,
        type: 'maintenance_urgent' as const,
        title: `URGENT: ${ticket.ticketNumber}`,
        body: `Urgent maintenance request "${ticket.title}" requires immediate attention.`,
        linkUrl: link,
      }))
    )

    // Emails
    const location = locationString(ticket)
    for (const head of heads) {
      sendMaintenanceUrgentEmail({
        to: head.email,
        ticketNumber: ticket.ticketNumber,
        ticketTitle: ticket.title,
        priority: ticket.priority,
        category: ticket.category,
        location,
        ticketLink: link,
      }).catch((err) => console.error('[MaintenanceNotify] email maintenance_urgent failed:', err))
    }
  } catch (err) {
    console.error('[MaintenanceNotify] notifyUrgentTicket failed:', err)
  }
}

/**
 * NOTIF-02: Ticket assigned — notify assignee
 */
export async function notifyTicketAssigned(
  ticket: TicketSnapshot,
  assigneeId: string,
  orgId: string
): Promise<void> {
  try {
    const link = ticketLink(ticket.id)

    // Look up assignee
    const assignee = await rawPrisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, email: true, firstName: true, lastName: true },
    })
    if (!assignee) return

    // In-app
    await createNotification({
      userId: assigneeId,
      type: 'maintenance_assigned',
      title: `Ticket assigned: ${ticket.ticketNumber}`,
      body: `You've been assigned to "${ticket.title}". Priority: ${ticket.priority}.`,
      linkUrl: link,
    })

    // Email
    sendMaintenanceAssignedEmail({
      to: assignee.email,
      ticketNumber: ticket.ticketNumber,
      ticketTitle: ticket.title,
      priority: ticket.priority,
      category: ticket.category,
      ticketLink: link,
    }).catch((err) => console.error('[MaintenanceNotify] email maintenance_assigned failed:', err))
  } catch (err) {
    console.error('[MaintenanceNotify] notifyTicketAssigned failed:', err)
  }
}

/**
 * NOTIF-03: Ticket claimed — notify Head of Maintenance
 */
export async function notifyTicketClaimed(ticket: TicketSnapshot, orgId: string): Promise<void> {
  try {
    const link = ticketLink(ticket.id)
    const heads = await getMaintenanceHeads(orgId)
    if (heads.length === 0) return

    const assignedTo = ticket.assignedTo
    const techName = assignedTo
      ? `${assignedTo.firstName} ${assignedTo.lastName}`
      : 'A technician'

    // In-app
    await createBulkNotifications(
      heads.map((u) => ({
        userId: u.id,
        type: 'maintenance_claimed' as const,
        title: `${ticket.ticketNumber} claimed by ${techName}`,
        body: `"${ticket.title}" was claimed and will be started soon.`,
        linkUrl: link,
      }))
    )

    // Emails
    for (const head of heads) {
      sendMaintenanceClaimedEmail({
        to: head.email,
        ticketNumber: ticket.ticketNumber,
        ticketTitle: ticket.title,
        technicianName: techName,
        ticketLink: link,
      }).catch((err) => console.error('[MaintenanceNotify] email maintenance_claimed failed:', err))
    }
  } catch (err) {
    console.error('[MaintenanceNotify] notifyTicketClaimed failed:', err)
  }
}

/**
 * NOTIF-04, 06, 07, 08, 11: Status change notifications
 * Dispatches appropriate email + in-app based on new status.
 */
export async function notifyStatusChange(
  ticket: TicketSnapshot,
  newStatus: string,
  orgId: string
): Promise<void> {
  try {
    const link = ticketLink(ticket.id)
    const assignedTo = ticket.assignedTo
    const techName = assignedTo
      ? `${assignedTo.firstName} ${assignedTo.lastName}`
      : 'Unassigned'

    switch (newStatus) {
      case 'IN_PROGRESS': {
        // Notify submitter
        await createNotification({
          userId: ticket.submittedById,
          type: 'maintenance_in_progress',
          title: `Work started on ${ticket.ticketNumber}`,
          body: `Work has started on your maintenance request "${ticket.title}".`,
          linkUrl: link,
        })
        if (ticket.submittedBy?.email) {
          sendMaintenanceInProgressEmail({
            to: ticket.submittedBy.email,
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title,
            technicianName: techName,
            ticketLink: link,
          }).catch((err) => console.error('[MaintenanceNotify] email in_progress failed:', err))
        }
        break
      }

      case 'ON_HOLD': {
        const holdReason = (ticket.holdReason as string) || 'OTHER'
        // Notify submitter + Head
        await createNotification({
          userId: ticket.submittedById,
          type: 'maintenance_on_hold',
          title: `${ticket.ticketNumber} is on hold`,
          body: `Your maintenance request is temporarily on hold. Reason: ${holdReason}.`,
          linkUrl: link,
        })
        if (ticket.submittedBy?.email) {
          sendMaintenanceOnHoldEmail({
            to: ticket.submittedBy.email,
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title,
            holdReason,
            ticketLink: link,
          }).catch((err) => console.error('[MaintenanceNotify] email on_hold failed:', err))
        }

        // Notify heads too
        const heads = await getMaintenanceHeads(orgId)
        if (heads.length > 0) {
          await createBulkNotifications(
            heads
              .filter((h) => h.id !== ticket.submittedById)
              .map((h) => ({
                userId: h.id,
                type: 'maintenance_on_hold' as const,
                title: `${ticket.ticketNumber} placed on hold`,
                body: `"${ticket.title}" is on hold. Reason: ${holdReason}.`,
                linkUrl: link,
              }))
          )
          for (const head of heads.filter((h) => h.id !== ticket.submittedById)) {
            sendMaintenanceOnHoldEmail({
              to: head.email,
              ticketNumber: ticket.ticketNumber,
              ticketTitle: ticket.title,
              holdReason,
              ticketLink: link,
            }).catch((err) => console.error('[MaintenanceNotify] email on_hold (head) failed:', err))
          }
        }
        break
      }

      case 'QA': {
        // Notify Head that QA review is needed
        const heads = await getMaintenanceHeads(orgId)
        if (heads.length > 0) {
          await createBulkNotifications(
            heads.map((h) => ({
              userId: h.id,
              type: 'maintenance_qa_ready' as const,
              title: `QA review needed: ${ticket.ticketNumber}`,
              body: `"${ticket.title}" is ready for QA sign-off. Completed by ${techName}.`,
              linkUrl: link,
            }))
          )
          for (const head of heads) {
            sendMaintenanceQAReadyEmail({
              to: head.email,
              ticketNumber: ticket.ticketNumber,
              ticketTitle: ticket.title,
              technicianName: techName,
              ticketLink: link,
            }).catch((err) => console.error('[MaintenanceNotify] email qa_ready failed:', err))
          }
        }
        break
      }

      case 'DONE': {
        // Notify submitter
        await createNotification({
          userId: ticket.submittedById,
          type: 'maintenance_done',
          title: `${ticket.ticketNumber} completed`,
          body: `Your maintenance request "${ticket.title}" has been completed and closed.`,
          linkUrl: link,
        })
        if (ticket.submittedBy?.email) {
          sendMaintenanceDoneEmail({
            to: ticket.submittedBy.email,
            ticketNumber: ticket.ticketNumber,
            ticketTitle: ticket.title,
            ticketLink: link,
          }).catch((err) => console.error('[MaintenanceNotify] email done failed:', err))
        }
        break
      }

      case 'SCHEDULED': {
        // NOTIF-11: scheduled released — no special notification beyond submitter confirmation
        // (already covered by notifyTicketSubmitted at creation time)
        await createNotification({
          userId: ticket.submittedById,
          type: 'maintenance_scheduled_released',
          title: `${ticket.ticketNumber} released to backlog`,
          body: `Your scheduled maintenance request "${ticket.title}" has been released to the work queue.`,
          linkUrl: link,
        })
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('[MaintenanceNotify] notifyStatusChange failed:', err)
  }
}

/**
 * NOTIF-10: QA rejected — notify assigned technician
 */
export async function notifyQARejected(
  ticket: TicketSnapshot,
  rejectionNote: string,
  orgId: string
): Promise<void> {
  try {
    const link = ticketLink(ticket.id)
    const assignedTo = ticket.assignedTo
    if (!assignedTo) return

    await createNotification({
      userId: assignedTo.id,
      type: 'maintenance_qa_rejected',
      title: `QA not approved: ${ticket.ticketNumber}`,
      body: `Your QA submission was not approved. "${rejectionNote}"`,
      linkUrl: link,
    })

    if (assignedTo.email) {
      sendMaintenanceQARejectedEmail({
        to: assignedTo.email,
        ticketNumber: ticket.ticketNumber,
        ticketTitle: ticket.title,
        rejectionNote,
        ticketLink: link,
      }).catch((err) => console.error('[MaintenanceNotify] email qa_rejected failed:', err))
    }
  } catch (err) {
    console.error('[MaintenanceNotify] notifyQARejected failed:', err)
  }
}

/**
 * NOTIF-09: Stale ticket alert (48h unassigned) — notify Head
 */
export async function notifyStaleTicket(ticket: TicketSnapshot, orgId: string): Promise<void> {
  try {
    const link = ticketLink(ticket.id)
    const heads = await getMaintenanceHeads(orgId)
    if (heads.length === 0) return

    // Calculate age
    const createdAt = await rawPrisma.maintenanceTicket.findUnique({
      where: { id: ticket.id },
      select: { createdAt: true },
    })
    const ageHours = createdAt
      ? Math.floor((Date.now() - createdAt.createdAt.getTime()) / (1000 * 60 * 60))
      : 48
    const ticketAge = `${ageHours} hours`

    // In-app
    await createBulkNotifications(
      heads.map((h) => ({
        userId: h.id,
        type: 'maintenance_stale' as const,
        title: `Unassigned ticket: ${ticket.ticketNumber}`,
        body: `"${ticket.title}" has been in the backlog for ${ticketAge} without assignment.`,
        linkUrl: link,
      }))
    )

    // Emails
    for (const head of heads) {
      sendMaintenanceStaleEmail({
        to: head.email,
        ticketNumber: ticket.ticketNumber,
        ticketTitle: ticket.title,
        priority: ticket.priority,
        ticketAge,
        ticketLink: link,
      }).catch((err) => console.error('[MaintenanceNotify] email stale failed:', err))
    }
  } catch (err) {
    console.error('[MaintenanceNotify] notifyStaleTicket failed:', err)
  }
}
