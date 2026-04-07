/**
 * Event Project Service — Notification Helpers
 *
 * Team notification dispatch for gate approvals and creator status updates.
 */

import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'
import * as notificationService from '@/lib/services/notificationService'
import type { ApprovalGates, GateType } from './eventProject-gates'

const db = prisma as unknown as OrgPrismaClient

// ─── Notification Constants ─────────────────────────────────────────────────

const GATE_TEAM_SLUGS: Record<string, string> = {
  av: 'av-production',
  facilities: 'facility-maintenance',
}

// ─── Notification Helpers ────────────────────────────────────────────────────

/**
 * Notifies team members when an event needs their approval gate.
 * Looks up team membership by slug and sends in-app notifications.
 */
export async function notifyTeamsOfPendingApproval(
  eventTitle: string,
  eventProjectId: string,
  gates: ApprovalGates,
): Promise<void> {
  for (const [gateKey, gate] of Object.entries(gates)) {
    if (!gate || gate.status !== 'PENDING' || gateKey === 'admin') continue

    const teamSlug = GATE_TEAM_SLUGS[gateKey]
    if (!teamSlug) continue

    // Find team members via team slug
    const team = await rawPrisma.team.findFirst({
      where: { slug: teamSlug },
      select: { id: true },
    })
    if (!team) continue

    const members = await rawPrisma.userTeam.findMany({
      where: { teamId: team.id },
      select: { userId: true },
    })

    const gateLabel = gateKey === 'av' ? 'A/V Production' : 'Facilities'
    const linkUrl = gateKey === 'av' ? '/av/event-approvals' : '/maintenance/event-approvals'

    for (const member of members) {
      notificationService.createNotification({
        userId: member.userId,
        type: 'event_invite', // Closest existing notification type
        title: `Event needs ${gateLabel} approval`,
        body: `"${eventTitle}" requires ${gateLabel} review before it can proceed.`,
        linkUrl,
      })
    }
  }
}

/**
 * Notifies the event creator when a gate status changes.
 */
export async function notifyCreatorOfGateChange(
  eventProjectId: string,
  gateType: GateType,
  status: 'APPROVED' | 'REJECTED',
  reason?: string,
): Promise<void> {
  const project = await db.eventProject.findUnique({
    where: { id: eventProjectId },
    select: { title: true, createdById: true },
  })
  if (!project?.createdById) return

  const gateLabel = gateType === 'av' ? 'A/V Production' : gateType === 'facilities' ? 'Facilities' : 'Admin'
  const notificationType = status === 'APPROVED' ? 'event_approved' : 'event_rejected'
  const title = status === 'APPROVED'
    ? `${gateLabel} approved your event "${project.title}"`
    : `${gateLabel} sent back your event "${project.title}"`
  const body = status === 'REJECTED' && reason
    ? `Reason: ${reason}`
    : status === 'APPROVED'
      ? `The ${gateLabel} team has signed off.`
      : undefined

  notificationService.createNotification({
    userId: project.createdById,
    type: notificationType as 'event_approved' | 'event_rejected',
    title,
    body,
    linkUrl: `/events/${eventProjectId}`,
  })
}
