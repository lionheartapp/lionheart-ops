/**
 * Event Project Service — Notification Helpers
 *
 * Config-driven team notification dispatch for gate approvals,
 * creator status updates, and NOTIFICATION-mode channel alerts.
 */

import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'
import * as notificationService from '@/lib/services/notificationService'
import {
  getTeamIdForGate,
  GATE_META,
  type ApprovalGates,
  type GateType,
} from './eventProject-gates'

const db = prisma as unknown as OrgPrismaClient

// ─── Notification Helpers ────────────────────────────────────────────────────

/**
 * Notifies team members when an event needs their approval gate.
 * Reads assignedTeamId from ApprovalChannelConfig instead of hardcoded slugs.
 * Now includes admin gate notifications (previously skipped).
 */
export async function notifyTeamsOfPendingApproval(
  eventTitle: string,
  eventProjectId: string,
  gates: ApprovalGates,
): Promise<void> {
  for (const [gateKey, gate] of Object.entries(gates)) {
    if (!gate || gate.status !== 'PENDING') continue

    const teamId = await getTeamIdForGate(gateKey as GateType)
    if (!teamId) continue

    const members = await rawPrisma.userTeam.findMany({
      where: { teamId },
      select: { userId: true },
    })

    const meta = GATE_META[gateKey as GateType]
    const gateLabel = meta?.label ?? gateKey
    const linkUrl = meta?.defaultUrl ?? '/events'

    for (const member of members) {
      notificationService.createNotification({
        userId: member.userId,
        type: 'event_invite',
        title: `Event needs ${gateLabel} approval`,
        body: `"${eventTitle}" requires ${gateLabel} review before it can proceed.`,
        linkUrl,
      })
    }
  }
}

/**
 * Sends non-blocking notifications for NOTIFICATION-mode channels.
 * These are informational — the event doesn't wait for approval.
 */
export async function notifyTeamsOfEventInfo(
  eventTitle: string,
  eventProjectId: string,
  channelTypes: string[],
): Promise<void> {
  const { CHANNEL_TO_GATE } = await import('./eventProject-gates')

  for (const channelType of channelTypes) {
    const gateKey = CHANNEL_TO_GATE[channelType]
    if (!gateKey) continue

    const teamId = await getTeamIdForGate(gateKey)
    if (!teamId) continue

    const members = await rawPrisma.userTeam.findMany({
      where: { teamId },
      select: { userId: true },
    })

    const meta = GATE_META[gateKey]
    const gateLabel = meta?.label ?? gateKey

    for (const member of members) {
      notificationService.createNotification({
        userId: member.userId,
        type: 'event_invite',
        title: `New event: "${eventTitle}"`,
        body: `This event has been submitted. Your team (${gateLabel}) has been notified for awareness.`,
        linkUrl: `/events/${eventProjectId}`,
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

  const meta = GATE_META[gateType]
  const gateLabel = meta?.label ?? gateType
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

// ─── V2 Team-Based Notifications ────────────────────────────────────────────

import type { GateStateV2 } from './approvalFlowService'

/**
 * V2: Notify team members when a team-based gate is pending.
 * Gate keys are team IDs — notify members of that team directly.
 */
export async function notifyV2TeamsOfPendingApproval(
  eventTitle: string,
  eventProjectId: string,
  gates: Record<string, GateStateV2>,
): Promise<void> {
  for (const [teamId, gate] of Object.entries(gates)) {
    if (gate.status !== 'PENDING') continue

    const members = await rawPrisma.userTeam.findMany({
      where: { teamId },
      select: { userId: true },
    })

    for (const member of members) {
      notificationService.createNotification({
        userId: member.userId,
        type: 'event_invite',
        title: `Event needs ${gate.teamName} approval`,
        body: `"${eventTitle}" requires ${gate.teamName} review before it can proceed.`,
        linkUrl: `/events/${eventProjectId}`,
      })
    }
  }
}

/**
 * V2: Send non-blocking notifications for NOTIFICATION-mode teams.
 */
export async function notifyV2TeamsOfEventInfo(
  eventTitle: string,
  eventProjectId: string,
  entries: Array<{ teamId: string; teamName: string }>,
): Promise<void> {
  for (const entry of entries) {
    const members = await rawPrisma.userTeam.findMany({
      where: { teamId: entry.teamId },
      select: { userId: true },
    })

    for (const member of members) {
      notificationService.createNotification({
        userId: member.userId,
        type: 'event_invite',
        title: `New event: "${eventTitle}"`,
        body: `This event has been submitted. Your team (${entry.teamName}) has been notified for awareness.`,
        linkUrl: `/events/${eventProjectId}`,
      })
    }
  }
}
