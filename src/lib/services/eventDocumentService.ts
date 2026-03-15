/**
 * Event Document Service
 *
 * Manages document requirements, per-participant completion tracking,
 * reminder emails, and off-campus compliance checklist items.
 *
 * Uses org-scoped `prisma` client — always called from within runWithOrgContext.
 */

import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateDocumentRequirementInput {
  eventProjectId: string
  label: string
  description?: string
  documentType: string
  isRequired?: boolean
  dueDate?: Date | string | null
  sortOrder?: number
}

export interface UpdateDocumentRequirementInput {
  label?: string
  description?: string | null
  documentType?: string
  isRequired?: boolean
  dueDate?: Date | string | null
  sortOrder?: number
}

export interface UpsertComplianceItemInput {
  id?: string
  eventProjectId: string
  label: string
  description?: string | null
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'
  assigneeId?: string | null
  dueDate?: Date | string | null
  fileUrl?: string | null
  sortOrder?: number
}

export interface DefaultComplianceItem {
  label: string
  description: string
  sortOrder: number
}

// ─── Document Requirements ────────────────────────────────────────────────────

/**
 * Create a new document requirement for an event.
 * Auto-creates empty EventDocumentCompletion rows for all existing REGISTERED participants.
 */
export async function createDocumentRequirement(
  data: CreateDocumentRequirementInput,
) {
  const requirement = await (prisma as any).eventDocumentRequirement.create({
    data: {
      eventProjectId: data.eventProjectId,
      label: data.label,
      description: data.description ?? null,
      documentType: data.documentType,
      isRequired: data.isRequired ?? true,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      sortOrder: data.sortOrder ?? 0,
    },
  })

  // Auto-create empty completion rows for all existing REGISTERED participants
  const registrations = await (prisma as any).eventRegistration.findMany({
    where: {
      eventProjectId: data.eventProjectId,
      status: 'REGISTERED',
    },
    select: { id: true, organizationId: true },
  })

  if (registrations.length > 0) {
    await rawPrisma.eventDocumentCompletion.createMany({
      data: registrations.map((reg: { id: string; organizationId: string }) => ({
        organizationId: reg.organizationId,
        eventProjectId: data.eventProjectId,
        registrationId: reg.id,
        requirementId: requirement.id,
        isComplete: false,
      })),
      skipDuplicates: true,
    })
  }

  return requirement
}

/**
 * Update a document requirement's metadata.
 */
export async function updateDocumentRequirement(
  id: string,
  data: UpdateDocumentRequirementInput,
) {
  return (prisma as any).eventDocumentRequirement.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.documentType !== undefined && { documentType: data.documentType }),
      ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  })
}

/**
 * Hard-delete a document requirement and its cascade-deleted completions.
 */
export async function deleteDocumentRequirement(id: string) {
  return (prisma as any).eventDocumentRequirement.delete({ where: { id } })
}

/**
 * List all document requirements for an event, sorted by sortOrder.
 */
export async function listDocumentRequirements(eventProjectId: string) {
  return (prisma as any).eventDocumentRequirement.findMany({
    where: { eventProjectId },
    orderBy: { sortOrder: 'asc' },
  })
}

// ─── Completion Matrix ────────────────────────────────────────────────────────

/**
 * Returns the full document completion matrix:
 * - requirements array (list of all requirements)
 * - participants array (each with their completion status per requirement)
 */
export async function getDocumentMatrix(eventProjectId: string) {
  const [requirements, registrations] = await Promise.all([
    (prisma as any).eventDocumentRequirement.findMany({
      where: { eventProjectId },
      orderBy: { sortOrder: 'asc' },
    }),
    (prisma as any).eventRegistration.findMany({
      where: {
        eventProjectId,
        status: 'REGISTERED',
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        documentCompletions: {
          where: { eventProjectId },
        },
      },
    }),
  ])

  const participants = registrations.map((reg: {
    id: string
    firstName: string
    lastName: string
    photoUrl: string | null
    email: string
    documentCompletions: Array<{
      requirementId: string
      isComplete: boolean
      completedAt: Date | null
      fileUrl: string | null
      notes: string | null
    }>
  }) => {
    const completionMap = new Map(
      reg.documentCompletions.map((c: { requirementId: string }) => [c.requirementId, c]),
    )

    const completions = requirements.map((req: { id: string }) => {
      const completion = completionMap.get(req.id) as {
        requirementId: string
        isComplete: boolean
        completedAt: Date | null
        fileUrl: string | null
        notes: string | null
      } | undefined
      return {
        requirementId: req.id,
        isComplete: completion?.isComplete ?? false,
        completedAt: completion?.completedAt?.toISOString() ?? null,
        fileUrl: completion?.fileUrl ?? null,
        notes: completion?.notes ?? null,
      }
    })

    const completedCount = completions.filter((c: { isComplete: boolean }) => c.isComplete).length

    return {
      registrationId: reg.id,
      firstName: reg.firstName,
      lastName: reg.lastName,
      photoUrl: reg.photoUrl,
      email: reg.email,
      completions,
      completedCount,
      totalCount: requirements.length,
      isFullyComplete: completedCount === requirements.length,
    }
  })

  return {
    requirements,
    participants,
  }
}

/**
 * Toggle a single document completion record.
 * Upserts the EventDocumentCompletion row.
 */
export async function toggleCompletion(
  registrationId: string,
  requirementId: string,
  isComplete: boolean,
) {
  // Look up the requirement to get eventProjectId and org info
  const requirement = await rawPrisma.eventDocumentRequirement.findUnique({
    where: { id: requirementId },
    select: { eventProjectId: true, organizationId: true },
  })

  if (!requirement) {
    throw new Error(`Document requirement not found: ${requirementId}`)
  }

  return rawPrisma.eventDocumentCompletion.upsert({
    where: {
      registrationId_requirementId: { registrationId, requirementId },
    },
    create: {
      organizationId: requirement.organizationId,
      eventProjectId: requirement.eventProjectId,
      registrationId,
      requirementId,
      isComplete,
      completedAt: isComplete ? new Date() : null,
    },
    update: {
      isComplete,
      completedAt: isComplete ? new Date() : null,
    },
  })
}

// ─── Reminders ────────────────────────────────────────────────────────────────

/**
 * Returns all registrations with at least one incomplete required document.
 */
export async function getIncompleteParticipants(eventProjectId: string) {
  const requirements = await (prisma as any).eventDocumentRequirement.findMany({
    where: { eventProjectId, isRequired: true },
    select: { id: true },
  })

  const requirementIds = requirements.map((r: { id: string }) => r.id)
  if (requirementIds.length === 0) return []

  const registrations = await (prisma as any).eventRegistration.findMany({
    where: {
      eventProjectId,
      status: 'REGISTERED',
    },
    include: {
      documentCompletions: {
        where: {
          requirementId: { in: requirementIds },
          isComplete: false,
        },
      },
    },
  })

  return registrations.filter(
    (reg: { documentCompletions: unknown[] }) => reg.documentCompletions.length > 0,
  )
}

/**
 * Send reminder emails to families with incomplete documents.
 *
 * Options:
 * - requirementId: if provided, only send reminders for that specific requirement.
 *   Otherwise, sends to anyone with any incomplete required document.
 *
 * Returns the count of reminders sent.
 */
export async function sendDocumentReminder(
  eventProjectId: string,
  options: { requirementId?: string } = {},
): Promise<number> {
  // Find the event project for display info (using rawPrisma since we need cross-org-safe lookup)
  const eventProject = await rawPrisma.eventProject.findUnique({
    where: { id: eventProjectId },
    select: { title: true, startsAt: true, organizationId: true },
  })

  if (!eventProject) {
    throw new Error(`EventProject not found: ${eventProjectId}`)
  }

  const org = await rawPrisma.organization.findUnique({
    where: { id: eventProject.organizationId },
    select: { name: true },
  })

  const orgName = org?.name ?? 'Your School'
  const eventTitle = eventProject.title

  // Find requirements that are incomplete
  let requirementWhere: Record<string, unknown> = {
    eventProjectId,
    isRequired: true,
  }
  if (options.requirementId) {
    requirementWhere = { id: options.requirementId }
  }

  const requirements = await rawPrisma.eventDocumentRequirement.findMany({
    where: requirementWhere,
    select: { id: true, label: true },
  })

  if (requirements.length === 0) return 0

  const requirementIds = requirements.map((r: { id: string }) => r.id)
  const requirementLabels = new Map(
    requirements.map((r: { id: string; label: string }) => [r.id, r.label]),
  )

  // Find registrations with incomplete documents
  const registrations = await rawPrisma.eventRegistration.findMany({
    where: {
      eventProjectId,
      status: 'REGISTERED',
    },
    include: {
      documentCompletions: {
        where: {
          requirementId: { in: requirementIds },
          isComplete: false,
        },
        select: { requirementId: true },
      },
    },
  })

  const incompleteRegistrations = registrations.filter(
    (reg) => reg.documentCompletions.length > 0,
  )

  if (incompleteRegistrations.length === 0) return 0

  // Lazy import to avoid circular dependency
  const { getResendConfig, getSmtpConfig, sendReminderEmail } = await importEmailHelpers()

  let sentCount = 0

  for (const reg of incompleteRegistrations) {
    const incompleteLabels = reg.documentCompletions
      .map((c) => requirementLabels.get(c.requirementId) ?? 'Unknown Document')
      .join(', ')

    const result = await sendReminderEmail(
      {
        to: reg.email,
        firstName: reg.firstName,
        orgName,
        eventTitle,
        incompleteDocuments: incompleteLabels,
      },
      { getResendConfig, getSmtpConfig },
    )

    if (result.sent) sentCount++
  }

  return sentCount
}

// ─── Email Helper (inline to avoid circular deps) ─────────────────────────────

async function importEmailHelpers() {
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'Lionheart <no-reply@lionheartapp.com>'

  function getResendConfig() {
    if (!resendApiKey) return null
    return { apiKey: resendApiKey, from }
  }

  function getSmtpConfig() {
    const host = process.env.SMTP_HOST?.trim()
    const portRaw = process.env.SMTP_PORT?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS?.trim()
    const smtpFrom = process.env.MAIL_FROM?.trim() || 'Lionheart <no-reply@lionheartapp.com>'
    if (!host || !portRaw || !user || !pass) return null
    const port = Number(portRaw)
    if (!Number.isFinite(port)) return null
    const secure = process.env.SMTP_SECURE === 'true' || port === 465
    return { host, port, secure, auth: { user, pass }, from: smtpFrom }
  }

  async function sendReminderEmail(
    data: {
      to: string
      firstName: string
      orgName: string
      eventTitle: string
      incompleteDocuments: string
    },
    providers: {
      getResendConfig: () => { apiKey: string; from: string } | null
      getSmtpConfig: () => {
        host: string
        port: number
        secure: boolean
        auth: { user: string; pass: string }
        from: string
      } | null
    },
  ): Promise<{ sent: boolean; reason?: string }> {
    const subject = `Action Required: Missing Documents for ${data.eventTitle}`

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px;">
      <p style="color: #fef3c7; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">${data.orgName}</p>
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Action Required</h1>
      <p style="color: #fef9c3; margin: 8px 0 0; font-size: 14px;">Missing documents for ${data.eventTitle}</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; margin: 0 0 8px; font-size: 15px;">Hi ${data.firstName},</p>
      <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
        We're missing required documents for <strong>${data.eventTitle}</strong>.
        Please submit the following as soon as possible to secure your participant's spot.
      </p>
      <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #92400e; font-size: 13px; font-weight: 600; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.05em;">Missing Documents</p>
        <p style="color: #b45309; font-size: 14px; margin: 0;">${data.incompleteDocuments}</p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        Sent by ${data.orgName} via Lionheart. If you have questions, contact your school directly.
      </p>
    </div>
  </div>
</body>
</html>`

    const text = `Action Required: Missing Documents for ${data.eventTitle}

Hi ${data.firstName},

We are missing required documents for ${data.eventTitle}. Please submit the following:

${data.incompleteDocuments}

Contact your school if you have questions.

Sent by ${data.orgName} via Lionheart.`

    const resendCfg = providers.getResendConfig()
    if (resendCfg) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendCfg.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendCfg.from,
            to: [data.to],
            subject,
            html,
            text,
          }),
        })
        if (res.ok) return { sent: true }
        const body = await res.text()
        console.error('[eventDocumentService] Resend failed:', res.status, body)
      } catch (err) {
        console.error('[eventDocumentService] Resend error:', err)
      }
    }

    const smtpCfg = providers.getSmtpConfig()
    if (smtpCfg) {
      try {
        const nodemailer = await import('nodemailer')
        const transporter = nodemailer.default.createTransport({
          host: smtpCfg.host,
          port: smtpCfg.port,
          secure: smtpCfg.secure,
          auth: smtpCfg.auth,
        })
        await transporter.sendMail({ from: smtpCfg.from, to: data.to, subject, html, text })
        return { sent: true }
      } catch (err) {
        console.error('[eventDocumentService] SMTP error:', err)
        return { sent: false, reason: 'SMTP_SEND_FAILED' }
      }
    }

    return { sent: false, reason: 'NO_EMAIL_PROVIDER_CONFIGURED' }
  }

  return { getResendConfig, getSmtpConfig, sendReminderEmail }
}

// ─── Compliance Checklist ─────────────────────────────────────────────────────

/**
 * List all compliance checklist items for an event, sorted by sortOrder.
 */
export async function listComplianceItems(eventProjectId: string) {
  return (prisma as any).eventComplianceItem.findMany({
    where: { eventProjectId },
    orderBy: { sortOrder: 'asc' },
    include: {
      assignee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  })
}

/**
 * Create or update a compliance checklist item.
 * If `id` is provided and exists, updates the record. Otherwise creates new.
 */
export async function upsertComplianceItem(data: UpsertComplianceItemInput) {
  if (data.id) {
    return (prisma as any).eventComplianceItem.update({
      where: { id: data.id },
      data: {
        label: data.label,
        description: data.description ?? null,
        status: data.status ?? 'NOT_STARTED',
        assigneeId: data.assigneeId ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        fileUrl: data.fileUrl ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })
  }

  return (prisma as any).eventComplianceItem.create({
    data: {
      eventProjectId: data.eventProjectId,
      label: data.label,
      description: data.description ?? null,
      status: data.status ?? 'NOT_STARTED',
      assigneeId: data.assigneeId ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      fileUrl: data.fileUrl ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
    include: {
      assignee: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  })
}

/**
 * Hard-delete a compliance checklist item.
 */
export async function deleteComplianceItem(id: string) {
  return (prisma as any).eventComplianceItem.delete({ where: { id } })
}

/**
 * Returns a static list of common off-campus compliance checklist items
 * that staff can import as defaults.
 */
export function getDefaultComplianceChecklist(): DefaultComplianceItem[] {
  return [
    {
      label: 'Liability Insurance Certificate',
      description: 'Obtain a certificate of liability insurance from venue or activity provider.',
      sortOrder: 1,
    },
    {
      label: 'Vehicle Inspection',
      description: 'Verify all transport vehicles pass safety inspection and are properly registered.',
      sortOrder: 2,
    },
    {
      label: 'Driver Background Checks',
      description: 'Complete background checks for all drivers transporting students.',
      sortOrder: 3,
    },
    {
      label: 'Vendor Contracts Signed',
      description: 'All third-party vendor contracts reviewed, signed, and filed.',
      sortOrder: 4,
    },
    {
      label: 'Venue Safety Certification',
      description: 'Confirm venue has current fire safety, occupancy, and operational certifications.',
      sortOrder: 5,
    },
    {
      label: 'Emergency Action Plan',
      description: 'Emergency action plan documented and distributed to all chaperones and staff.',
      sortOrder: 6,
    },
  ]
}
