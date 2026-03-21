import { prisma, rawPrisma } from '@/lib/db'
import { appendActivityLog } from '@/lib/services/eventProjectService'
import { createNotification } from '@/lib/services/notificationService'
import { logger } from '@/lib/logger'
import type { AddEventTeamMemberInput, UpdateEventTeamMemberInput } from '@/lib/types/event-project'

const log = logger.child({ service: 'eventTeamService' })

const db = prisma as any

const MEMBER_INCLUDE = {
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
  addedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
}

/**
 * Lists all team members for an EventProject.
 */
export async function listTeamMembers(
  eventProjectId: string,
): Promise<Record<string, unknown>[]> {
  return db.eventTeamMember.findMany({
    where: { eventProjectId },
    include: MEMBER_INCLUDE,
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Adds a user to an EventProject's team.
 * Throws P2002 (unique constraint) if user is already on the team.
 */
export async function addTeamMember(
  eventProjectId: string,
  data: AddEventTeamMemberInput,
  actorId: string,
): Promise<Record<string, unknown>> {
  const member = await db.eventTeamMember.create({
    data: {
      eventProjectId,
      userId: data.userId,
      role: data.role,
      notes: data.notes ?? null,
      addedById: actorId,
      // Per-member event permissions (default false via schema)
      ...(data.canManageTasks !== undefined && { canManageTasks: data.canManageTasks }),
      ...(data.canManageSchedule !== undefined && { canManageSchedule: data.canManageSchedule }),
      ...(data.canViewBudget !== undefined && { canViewBudget: data.canViewBudget }),
      ...(data.canManageLogistics !== undefined && { canManageLogistics: data.canManageLogistics }),
      ...(data.canManageCheckin !== undefined && { canManageCheckin: data.canManageCheckin }),
      ...(data.canSendComms !== undefined && { canSendComms: data.canSendComms }),
      ...(data.canViewRegistrations !== undefined && { canViewRegistrations: data.canViewRegistrations }),
      ...(data.canManageDocuments !== undefined && { canManageDocuments: data.canManageDocuments }),
    },
    include: MEMBER_INCLUDE,
  })

  await appendActivityLog(eventProjectId, actorId, 'TEAM_MEMBER_ADDED', {
    memberId: member.id,
    userId: data.userId,
    role: data.role,
    userName: [member.user?.firstName, member.user?.lastName].filter(Boolean).join(' '),
  })

  // Fire-and-forget: notify the added user (in-app + email)
  ;(async () => {
    try {
      // Fetch event + org info for the notification
      const eventProject = await rawPrisma.eventProject.findUnique({
        where: { id: eventProjectId },
        select: {
          title: true,
          startsAt: true,
          organization: { select: { name: true, slug: true } },
        },
      })
      if (!eventProject) return

      const eventTitle = eventProject.title
      const addedByName = [member.addedBy?.firstName, member.addedBy?.lastName]
        .filter(Boolean)
        .join(' ') || 'Someone'
      const roleName = data.role || 'Team Member'

      // In-app notification
      await createNotification({
        userId: data.userId,
        type: 'event_team_added',
        title: `You've been added to "${eventTitle}"`,
        body: `${addedByName} added you as ${roleName}.`,
        linkUrl: `/events/${eventProjectId}`,
      })

      // Email notification via Resend (fire-and-forget)
      const apiKey = process.env.RESEND_API_KEY?.trim()
      if (!apiKey || !member.user?.email) return

      const orgName = eventProject.organization?.name ?? 'Your School'
      const from = process.env.MAIL_FROM?.trim() || 'Lionheart <no-reply@lionheartapp.com>'
      const appUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
      const eventLink = `${appUrl}/events/${eventProjectId}`
      const recipientName = member.user?.firstName || 'there'
      const eventDate = eventProject.startsAt
        ? new Date(eventProject.startsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : null

      const subject = `You've been added to "${eventTitle}"`
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 28px 32px;">
      <p style="color: #bfdbfe; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">${orgName}</p>
      <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">You've been added to the team</h1>
      <p style="color: #e0e7ff; margin: 6px 0 0; font-size: 13px;">${eventTitle}${eventDate ? ` · ${eventDate}` : ''}</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; margin: 0 0 16px; font-size: 15px;">Hi ${recipientName},</p>
      <p style="color: #374151; font-size: 14px; line-height: 1.7; margin: 0 0 8px;">
        <strong>${addedByName}</strong> added you to <strong>${eventTitle}</strong> as <strong>${roleName}</strong>.
      </p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.7; margin: 0 0 24px;">
        You can view the event details, schedule, and tasks by clicking below.
      </p>
      <a href="${eventLink}"
         style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 24px;">
        View Event
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        Sent by ${orgName} via Lionheart.
      </p>
    </div>
  </div>
</body>
</html>`

      const text = `Hi ${recipientName},\n\n${addedByName} added you to "${eventTitle}" as ${roleName}.\n\nView event: ${eventLink}\n\nSent by ${orgName} via Lionheart.`

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [member.user.email], subject, html, text }),
      })
    } catch (err) {
      log.error({ err }, 'Failed to send team-member-added notification')
    }
  })()

  return member
}

/**
 * Updates a team member's role or notes.
 */
export async function updateTeamMember(
  memberId: string,
  data: UpdateEventTeamMemberInput,
  actorId: string,
  eventProjectId: string,
): Promise<Record<string, unknown>> {
  const existing = await db.eventTeamMember.findUnique({ where: { id: memberId } })
  if (!existing) throw new Error(`EventTeamMember not found: ${memberId}`)

  const updateData: Record<string, unknown> = {}
  if (data.role !== undefined) updateData.role = data.role
  if (data.notes !== undefined) updateData.notes = data.notes
  // Permission booleans
  if (data.canManageTasks !== undefined) updateData.canManageTasks = data.canManageTasks
  if (data.canManageSchedule !== undefined) updateData.canManageSchedule = data.canManageSchedule
  if (data.canViewBudget !== undefined) updateData.canViewBudget = data.canViewBudget
  if (data.canManageLogistics !== undefined) updateData.canManageLogistics = data.canManageLogistics
  if (data.canManageCheckin !== undefined) updateData.canManageCheckin = data.canManageCheckin
  if (data.canSendComms !== undefined) updateData.canSendComms = data.canSendComms
  if (data.canViewRegistrations !== undefined) updateData.canViewRegistrations = data.canViewRegistrations
  if (data.canManageDocuments !== undefined) updateData.canManageDocuments = data.canManageDocuments

  const updated = await db.eventTeamMember.update({
    where: { id: memberId },
    data: updateData,
    include: MEMBER_INCLUDE,
  })

  await appendActivityLog(eventProjectId, actorId, 'TEAM_MEMBER_UPDATED', {
    memberId,
    changes: Object.keys(updateData),
    userName: [updated.user?.firstName, updated.user?.lastName].filter(Boolean).join(' '),
  })

  return updated
}

/**
 * Removes a team member (hard delete).
 */
export async function removeTeamMember(
  memberId: string,
  actorId: string,
  eventProjectId: string,
): Promise<void> {
  const existing = await db.eventTeamMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { firstName: true, lastName: true } } },
  })
  if (!existing) throw new Error(`EventTeamMember not found: ${memberId}`)

  await db.eventTeamMember.delete({ where: { id: memberId } })

  await appendActivityLog(eventProjectId, actorId, 'TEAM_MEMBER_REMOVED', {
    memberId,
    userId: existing.userId,
    role: existing.role,
    userName: [existing.user?.firstName, existing.user?.lastName].filter(Boolean).join(' '),
  })
}
