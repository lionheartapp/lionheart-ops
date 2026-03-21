/**
 * Event Announcement Service
 *
 * Targeted announcements to event participants.
 * Supports 5 audience types: ALL, GROUP, INCOMPLETE_DOCS, PAID_ONLY, TEAM.
 * Sends email to each recipient and returns the created announcement.
 */

import { prisma, rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { EventAnnouncementWithAuthor } from '@/lib/types/events-phase21'

const log = logger.child({ service: 'eventAnnouncementService' })

// ─── Config ───────────────────────────────────────────────────────────────────

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
}

function getResendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null
}

function getMailFrom(): string {
  return process.env.MAIL_FROM?.trim() || 'Lionheart <no-reply@lionheartapp.com>'
}

// ─── Email Helper ─────────────────────────────────────────────────────────────

async function sendAnnouncementEmail(
  to: string,
  recipientName: string,
  title: string,
  body: string,
  eventTitle: string,
  portalUrl: string,
  orgName: string,
): Promise<void> {
  const apiKey = getResendApiKey()
  if (!apiKey) {
    log.warn('No RESEND_API_KEY — skipping announcement email')
    return
  }

  const subject = `Announcement: ${title}`
  const from = getMailFrom()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 28px 32px;">
      <p style="color: #bfdbfe; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">${orgName}</p>
      <h1 style="color: white; margin: 0; font-size: 20px; font-weight: 700;">${title}</h1>
      <p style="color: #e0e7ff; margin: 6px 0 0; font-size: 13px;">${eventTitle}</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; margin: 0 0 8px; font-size: 15px;">Hi ${recipientName},</p>
      <div style="color: #374151; font-size: 14px; line-height: 1.7; margin-bottom: 24px; white-space: pre-wrap;">${body}</div>
      <a href="${portalUrl}"
         style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 24px;">
        View Event Portal
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        Sent by ${orgName} via Lionheart.
      </p>
    </div>
  </div>
</body>
</html>`

  const text = `${title}\n\nHi ${recipientName},\n\n${body}\n\nView your event portal: ${portalUrl}\n\nSent by ${orgName} via Lionheart.`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      log.error({ status: res.status, body: errBody }, 'Resend failed for announcement email')
    }
  } catch (err) {
    log.error({ err }, 'Failed to send announcement email')
  }
}

// ─── Recipient Resolution ─────────────────────────────────────────────────────

type Recipient = { email: string; firstName: string; registrationId: string; paymentStatus: string }

async function resolveRecipients(
  eventProjectId: string,
  audience: string,
  targetGroupId: string | null,
): Promise<Recipient[]> {
  // Fetch all REGISTERED participants for the event
  const allRegistrations = await rawPrisma.eventRegistration.findMany({
    where: {
      eventProjectId,
      status: 'REGISTERED',
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      paymentStatus: true,
    },
  })

  if (audience === 'ALL') {
    return allRegistrations.map((r) => ({
      email: r.email,
      firstName: r.firstName,
      registrationId: r.id,
      paymentStatus: r.paymentStatus,
    }))
  }

  if (audience === 'GROUP' && targetGroupId) {
    // Participants in the targeted group
    const groupAssignments = await rawPrisma.eventGroupAssignment.findMany({
      where: { groupId: targetGroupId },
      select: { registrationId: true },
    })
    const groupRegistrationIds = new Set(groupAssignments.map((a) => a.registrationId))
    return allRegistrations
      .filter((r) => groupRegistrationIds.has(r.id))
      .map((r) => ({
        email: r.email,
        firstName: r.firstName,
        registrationId: r.id,
        paymentStatus: r.paymentStatus,
      }))
  }

  if (audience === 'INCOMPLETE_DOCS') {
    // Participants with at least one incomplete required document
    const completions = await rawPrisma.eventDocumentCompletion.findMany({
      where: { eventProjectId, isComplete: false },
      select: { registrationId: true },
    })
    const incompleteIds = new Set(completions.map((c) => c.registrationId))
    return allRegistrations
      .filter((r) => incompleteIds.has(r.id))
      .map((r) => ({
        email: r.email,
        firstName: r.firstName,
        registrationId: r.id,
        paymentStatus: r.paymentStatus,
      }))
  }

  if (audience === 'PAID_ONLY') {
    return allRegistrations
      .filter((r) => r.paymentStatus === 'PAID')
      .map((r) => ({
        email: r.email,
        firstName: r.firstName,
        registrationId: r.id,
        paymentStatus: r.paymentStatus,
      }))
  }

  return []
}

type TeamRecipient = { email: string; firstName: string; userId: string }

/**
 * Resolve event team members (staff) as recipients.
 */
async function resolveTeamRecipients(
  eventProjectId: string,
): Promise<TeamRecipient[]> {
  const members = await rawPrisma.eventTeamMember.findMany({
    where: { eventProjectId },
    select: {
      user: {
        select: { id: true, email: true, firstName: true },
      },
    },
  })

  return members
    .filter((m: any) => m.user?.email)
    .map((m: any) => ({
      email: m.user.email,
      firstName: m.user.firstName || 'Team Member',
      userId: m.user.id,
    }))
}

// ─── Service Functions ────────────────────────────────────────────────────────

export interface CreateAnnouncementInput {
  eventProjectId: string
  title: string
  body: string
  audience: 'ALL' | 'GROUP' | 'INCOMPLETE_DOCS' | 'PAID_ONLY' | 'TEAM'
  targetGroupId?: string | null
  createdById: string
}

/**
 * Create an announcement and send emails to targeted participants.
 * Fire-and-forget email delivery — errors are logged but do not throw.
 */
export async function createAnnouncement(
  data: CreateAnnouncementInput,
): Promise<EventAnnouncementWithAuthor> {
  const announcement = await prisma.eventAnnouncement.create({
    data: {
      eventProjectId: data.eventProjectId,
      title: data.title,
      body: data.body,
      audience: data.audience,
      targetGroupId: data.targetGroupId ?? null,
      sentAt: new Date(),
      createdById: data.createdById,
    } as any,
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
      targetGroup: {
        select: { name: true },
      },
    },
  }) as any

  // Fire-and-forget email delivery
  ;(async () => {
    try {
      // Fetch event info for email context
      const eventProject = await rawPrisma.eventProject.findUnique({
        where: { id: data.eventProjectId },
        select: {
          title: true,
          organization: { select: { name: true } },
        },
      })
      if (!eventProject) return

      const orgName = eventProject.organization?.name ?? 'Your School'
      const eventTitle = eventProject.title

      if (data.audience === 'TEAM') {
        // Send to event team members (staff) — link to event page, not registration portal
        const teamRecipients = await resolveTeamRecipients(data.eventProjectId)
        const eventUrl = `${getAppUrl()}/events/${data.eventProjectId}`

        await Promise.allSettled(
          teamRecipients.map((r) =>
            sendAnnouncementEmail(
              r.email,
              r.firstName,
              data.title,
              data.body,
              eventTitle,
              eventUrl,
              orgName,
            )
          ),
        )
      } else {
        // Send to registrants — link to registration portal
        const recipients = await resolveRecipients(
          data.eventProjectId,
          data.audience,
          data.targetGroupId ?? null,
        )

        await Promise.allSettled(
          recipients.map((r) => {
            const portalUrl = `${getAppUrl()}/registration/${r.registrationId}`
            return sendAnnouncementEmail(
              r.email,
              r.firstName,
              data.title,
              data.body,
              eventTitle,
              portalUrl,
              orgName,
            )
          }),
        )
      }
    } catch (err) {
      log.error({ err }, 'Failed to send announcement emails')
    }
  })()

  return shapeAnnouncement(announcement)
}

/**
 * List all announcements for an event project, newest first, with author info.
 */
export async function listAnnouncements(
  eventProjectId: string,
): Promise<EventAnnouncementWithAuthor[]> {
  const rows = await prisma.eventAnnouncement.findMany({
    where: { eventProjectId } as any,
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
      targetGroup: {
        select: { name: true },
      },
    },
  }) as any[]

  return rows.map(shapeAnnouncement)
}

/**
 * Hard-delete an announcement by ID.
 */
export async function deleteAnnouncement(id: string): Promise<void> {
  await prisma.eventAnnouncement.delete({ where: { id } } as any)
}

/**
 * Return announcements visible to a specific participant (parent portal).
 * Filters based on audience targeting rules.
 */
export async function getAnnouncementsForRegistration(
  registrationId: string,
): Promise<EventAnnouncementWithAuthor[]> {
  // Load the registration to understand group membership, doc status, payment status
  const registration = await rawPrisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      eventProjectId: true,
      paymentStatus: true,
    },
  })
  if (!registration) return []

  const { eventProjectId, paymentStatus } = registration

  // Load all announcements for this event
  const allAnnouncements = await rawPrisma.eventAnnouncement.findMany({
    where: { eventProjectId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
      targetGroup: {
        select: { name: true },
      },
    },
  }) as any[]

  if (allAnnouncements.length === 0) return []

  // Determine group IDs this participant belongs to
  const groupAssignments = await rawPrisma.eventGroupAssignment.findMany({
    where: { registrationId },
    select: { groupId: true },
  })
  const participantGroupIds = new Set(groupAssignments.map((a) => a.groupId))

  // Check if participant has any incomplete required documents
  const incompleteDoc = await rawPrisma.eventDocumentCompletion.findFirst({
    where: { registrationId, isComplete: false },
    select: { id: true },
  })
  const hasIncompleteDoc = incompleteDoc !== null

  // Filter announcements by audience targeting
  const visible = allAnnouncements.filter((ann: any) => {
    if (ann.audience === 'ALL') return true
    if (ann.audience === 'GROUP') {
      return ann.targetGroupId && participantGroupIds.has(ann.targetGroupId)
    }
    if (ann.audience === 'INCOMPLETE_DOCS') {
      return hasIncompleteDoc
    }
    if (ann.audience === 'PAID_ONLY') {
      return paymentStatus === 'PAID'
    }
    return false
  })

  return visible.map(shapeAnnouncement)
}

// ─── Internal Shaping ─────────────────────────────────────────────────────────

function shapeAnnouncement(row: any): EventAnnouncementWithAuthor {
  return {
    id: row.id,
    eventProjectId: row.eventProjectId,
    title: row.title,
    body: row.body,
    audience: row.audience,
    targetGroupId: row.targetGroupId ?? null,
    targetGroupName: row.targetGroup?.name ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdById: row.createdById,
    authorName: row.createdBy
      ? `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim()
      : 'Unknown',
    authorAvatar: row.createdBy?.avatar ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
