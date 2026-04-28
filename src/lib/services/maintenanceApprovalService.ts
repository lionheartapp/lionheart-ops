/**
 * Maintenance Ticket Approval Service
 *
 * Handles approve/reject gate actions on maintenance tickets.
 * Mirrors the event approval pattern in eventProjectService.ts.
 */

import { rawPrisma } from '@/lib/db'
import { createNotification } from './notificationService'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'maintenanceApprovalService' })

interface GateState {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'
  teamName: string
  trigger: string
  resourceType: string | null
  sortOrder: number
  respondedById?: string | null
  respondedAt?: string | null
  reason?: string | null
}

/**
 * Approve a specific gate on a maintenance ticket.
 * If all gates are cleared, transitions ticket to BACKLOG and triggers routing.
 */
export async function approveMaintenanceGate(
  ticketId: string,
  gateKey: string,
  userId: string,
): Promise<{ allCleared: boolean }> {
  const ticket = await rawPrisma.maintenanceTicket.findUniqueOrThrow({
    where: { id: ticketId },
    select: { id: true, approvalGates: true, status: true, title: true, submittedById: true, organizationId: true },
  })

  const gates = (ticket.approvalGates ?? {}) as Record<string, GateState>
  if (!gates[gateKey]) throw new Error('Gate not found')
  if (gates[gateKey].status !== 'PENDING') throw new Error('Gate already resolved')

  gates[gateKey] = {
    ...gates[gateKey],
    status: 'APPROVED',
    respondedById: userId,
    respondedAt: new Date().toISOString(),
  }

  const allCleared = Object.values(gates).every(
    (g) => g.status === 'APPROVED' || g.status === 'SKIPPED',
  )

  await rawPrisma.maintenanceTicket.update({
    where: { id: ticketId },
    data: {
      approvalGates: gates,
      ...(allCleared
        ? { status: 'BACKLOG', approvedById: userId, approvedAt: new Date() }
        : {}),
    },
  })

  // Log activity
  await rawPrisma.maintenanceTicketActivity.create({
    data: {
      organizationId: ticket.organizationId,
      ticketId,
      actorId: userId,
      type: 'STATUS_CHANGE',
      fromStatus: 'PENDING_APPROVAL',
      toStatus: allCleared ? 'BACKLOG' : 'PENDING_APPROVAL',
      content: allCleared
        ? 'All approvals cleared — ticket moved to backlog'
        : `Gate ${gates[gateKey].teamName} approved`,
      metadata: { gateKey, gates },
    },
  }).catch(() => {})

  // Notify submitter
  if (allCleared) {
    createNotification({
      userId: ticket.submittedById,
      type: 'ticket_update',
      title: 'Ticket Approved',
      body: `Your maintenance request "${ticket.title}" has been approved and is now in the queue.`,
      linkUrl: `/maintenance?ticket=${ticketId}`,
    }).catch(() => {})

    // Trigger auto-routing now that approval is cleared
    import('./ticketRoutingService').then(({ routeTicket }) => {
      // Need to fetch category for routing
      rawPrisma.maintenanceTicket.findUnique({
        where: { id: ticketId },
        select: { category: true, buildingId: true, submittedById: true, organizationId: true },
      }).then((t) => {
        if (!t) return
        routeTicket({
          module: 'MAINTENANCE',
          ticketId,
          categoryKey: t.category,
          buildingId: t.buildingId ?? null,
          submittedById: t.submittedById,
          orgId: t.organizationId,
        }).then(async (result) => {
          if (result.assignedToId) {
            await rawPrisma.maintenanceTicket.update({
              where: { id: ticketId },
              data: { assignedToId: result.assignedToId },
            })
            log.info({ ticketId, assignedTo: result.assignedToId }, 'Auto-routed after approval')
          }
        }).catch((err: unknown) => log.error({ err: String(err), ticketId }, 'Post-approval routing failed'))
      })
    }).catch(() => {})
  }

  return { allCleared }
}

/**
 * Reject a specific gate on a maintenance ticket.
 * Transitions ticket to CANCELLED with a rejection reason.
 */
export async function rejectMaintenanceGate(
  ticketId: string,
  gateKey: string,
  userId: string,
  reason: string,
): Promise<void> {
  const ticket = await rawPrisma.maintenanceTicket.findUniqueOrThrow({
    where: { id: ticketId },
    select: { id: true, approvalGates: true, title: true, submittedById: true, organizationId: true },
  })

  const gates = (ticket.approvalGates ?? {}) as Record<string, GateState>
  if (!gates[gateKey]) throw new Error('Gate not found')

  gates[gateKey] = {
    ...gates[gateKey],
    status: 'REJECTED',
    respondedById: userId,
    respondedAt: new Date().toISOString(),
    reason,
  }

  await rawPrisma.maintenanceTicket.update({
    where: { id: ticketId },
    data: {
      approvalGates: gates,
      status: 'CANCELLED',
      rejectionReason: reason,
    },
  })

  // Log activity
  await rawPrisma.maintenanceTicketActivity.create({
    data: {
      organizationId: ticket.organizationId,
      ticketId,
      actorId: userId,
      type: 'STATUS_CHANGE',
      fromStatus: 'PENDING_APPROVAL',
      toStatus: 'CANCELLED',
      content: `Ticket rejected: ${reason}`,
      metadata: { gateKey, gates, reason },
    },
  }).catch(() => {})

  // Notify submitter
  createNotification({
    userId: ticket.submittedById,
    type: 'ticket_update',
    title: 'Ticket Rejected',
    body: `Your maintenance request "${ticket.title}" was rejected: "${reason}"`,
    linkUrl: `/maintenance?ticket=${ticketId}`,
  }).catch(() => {})
}
