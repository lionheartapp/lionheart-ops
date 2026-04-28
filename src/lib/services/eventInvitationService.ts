import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { getOrgContextId } from '@/lib/org-context'
import type { InvitationStatus } from '@prisma/client'
import { createNotification } from './notificationService'

// ─── Create invitations for requested attendees ────────────────────────────

export async function createEventInvitations(
  eventProjectId: string,
  userIds: string[],
  invitedById: string,
  note?: string,
): Promise<void> {
  if (userIds.length === 0) return

  // Fetch the event title for notifications
  const event = await prisma.eventProject.findUnique({
    where: { id: eventProjectId },
    select: { title: true },
  })

  // Create invitation records (skip duplicates)
  for (const userId of userIds) {
    try {
      await prisma.eventInvitation.create({
        data: {
          organizationId: getOrgContextId(),
          eventProjectId,
          userId,
          invitedById,
          note: note || null,
          status: 'PENDING',
        },
      })

      // Send in-app notification
      await createNotification({
        userId,
        type: 'event_invite',
        title: 'Event Invitation',
        body: `You've been invited to "${event?.title ?? 'an event'}". Please respond.`,
        linkUrl: `/events/${eventProjectId}`,
      }).catch(() => {})
    } catch {
      // Duplicate — already invited, skip
    }
  }
}

// ─── Respond to an invitation ──────────────────────────────────────────────

export async function respondToInvitation(
  eventProjectId: string,
  userId: string,
  status: 'ACCEPTED' | 'MAYBE' | 'DECLINED',
  responseNote?: string,
): Promise<{ status: InvitationStatus; responseNote: string | null }> {
  const invitation = await prisma.eventInvitation.update({
    where: {
      eventProjectId_userId: { eventProjectId, userId },
    },
    data: {
      status,
      responseNote: responseNote?.trim() || null,
      respondedAt: new Date(),
    },
    include: {
      eventProject: { select: { title: true, createdById: true } },
    },
  })

  // Notify the event creator about the response
  const statusLabel = status === 'ACCEPTED' ? 'accepted' : status === 'MAYBE' ? 'might attend' : 'declined'

  const invitee = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  })
  const name = invitee?.firstName
    ? `${invitee.firstName}${invitee.lastName ? ` ${invitee.lastName}` : ''}`
    : invitee?.email ?? 'Someone'

  await createNotification({
    userId: invitation.eventProject.createdById,
    type: 'event_invite',
    title: `RSVP: ${name} ${statusLabel}`,
    body: responseNote
      ? `${name} ${statusLabel} "${invitation.eventProject.title}": "${responseNote}"`
      : `${name} ${statusLabel} "${invitation.eventProject.title}"`,
    linkUrl: `/events/${eventProjectId}`,
  }).catch(() => {})

  return { status: invitation.status, responseNote: invitation.responseNote }
}

// ─── Get invitations for an event ──────────────────────────────────────────

export async function getEventInvitations(eventProjectId: string) {
  return prisma.eventInvitation.findMany({
    where: { eventProjectId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          jobTitle: true,
        },
      },
      invitedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

// ─── Get a user's invitation for a specific event ──────────────────────────

export async function getUserInvitation(eventProjectId: string, userId: string) {
  return prisma.eventInvitation.findUnique({
    where: {
      eventProjectId_userId: { eventProjectId, userId },
    },
  })
}

// ─── Get all pending invitations for a user ────────────────────────────────

export async function getUserPendingInvitations(userId: string) {
  return rawPrisma.eventInvitation.findMany({
    where: { userId, status: 'PENDING' },
    include: {
      eventProject: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          locationText: true,
        },
      },
      invitedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}
