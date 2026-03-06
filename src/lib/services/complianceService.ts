/**
 * Compliance Service
 *
 * Manages regulatory compliance domains, records, calendar population, and
 * 30-day / 7-day reminder dispatch for schools.
 *
 * Uses rawPrisma for cross-org cron operations; prisma (org-scoped) in routes.
 */

import { z } from 'zod'
import { rawPrisma } from '@/lib/db'
import { createNotification } from '@/lib/services/notificationService'
import { sendComplianceReminderEmail } from '@/lib/services/emailService'
import { generateTicketNumber, CATEGORY_TO_SPECIALTY } from '@/lib/services/maintenanceTicketService'
import {
  COMPLIANCE_DOMAIN_DEFAULTS,
  COMPLIANCE_DOMAINS,
} from '@/lib/types/compliance'
import type {
  ComplianceDomain,
  ComplianceStatus,
  ComplianceOutcome,
  MaintenanceCategory,
} from '@prisma/client'

// Re-export for consumers that expect these from the service
export { COMPLIANCE_DOMAIN_DEFAULTS, COMPLIANCE_DOMAINS }
export type { ComplianceDomainMeta } from '@/lib/types/compliance'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const CreateDomainConfigSchema = z.object({
  domain: z.enum([
    'AHERA', 'FIRE_SAFETY', 'PLAYGROUND', 'LEAD_WATER', 'BOILER',
    'ELEVATOR', 'KITCHEN', 'ADA', 'RADON', 'IPM',
  ]),
  isEnabled: z.boolean().default(true),
  customDeadlineMonth: z.number().int().min(1).max(12).optional().nullable(),
  customDeadlineDay: z.number().int().min(1).max(31).optional().nullable(),
  schoolId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

const UpdateDomainConfigSchema = CreateDomainConfigSchema.partial()

const UpdateRecordSchema = z.object({
  outcome: z.enum(['PASSED', 'FAILED', 'CONDITIONAL_PASS', 'PENDING']).optional(),
  inspectionDate: z.string().datetime().optional().nullable(),
  inspector: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachments: z.array(z.string()).optional(),
  status: z.enum(['CURRENT', 'DUE_SOON', 'OVERDUE', 'NOT_APPLICABLE', 'PENDING']).optional(),
})

export type CreateDomainConfigInput = z.infer<typeof CreateDomainConfigSchema>
export type UpdateDomainConfigInput = z.infer<typeof UpdateDomainConfigSchema>
export type UpdateRecordInput = z.infer<typeof UpdateRecordSchema>

// ─── Domain Config CRUD ───────────────────────────────────────────────────────

/**
 * Upsert a domain config for an org+school+domain combo.
 * Creates if not exists, updates if exists.
 */
export async function createComplianceDomainConfig(
  orgId: string,
  input: unknown
) {
  const data = CreateDomainConfigSchema.parse(input)

  // Handle nullable schoolId in composite unique — find existing first, then upsert by id
  const existing = await rawPrisma.complianceDomainConfig.findFirst({
    where: {
      organizationId: orgId,
      schoolId: data.schoolId ?? null,
      domain: data.domain,
    },
  })

  if (existing) {
    return rawPrisma.complianceDomainConfig.update({
      where: { id: existing.id },
      data: {
        isEnabled: data.isEnabled,
        customDeadlineMonth: data.customDeadlineMonth ?? null,
        customDeadlineDay: data.customDeadlineDay ?? null,
        notes: data.notes ?? null,
      },
    })
  }

  return rawPrisma.complianceDomainConfig.create({
    data: {
      organizationId: orgId,
      schoolId: data.schoolId ?? null,
      domain: data.domain,
      isEnabled: data.isEnabled,
      customDeadlineMonth: data.customDeadlineMonth ?? null,
      customDeadlineDay: data.customDeadlineDay ?? null,
      notes: data.notes ?? null,
    },
  })
}

/**
 * Get all 10 domain configs for an org.
 * Returns all 10 domains regardless of whether a config row exists.
 * Domains without a config row default to isEnabled=true.
 */
export async function getComplianceDomainConfigs(orgId: string, schoolId?: string | null) {
  const existing = await rawPrisma.complianceDomainConfig.findMany({
    where: {
      organizationId: orgId,
      schoolId: schoolId ?? null,
    },
    include: {
      records: {
        where: {
          deletedAt: null,
          dueDate: { gte: new Date() },
        },
        orderBy: { dueDate: 'asc' },
        take: 1,
      },
    },
  })

  const existingMap = new Map(existing.map((c) => [c.domain, c]))

  return COMPLIANCE_DOMAINS.map((domain) => {
    const config = existingMap.get(domain)
    const meta = COMPLIANCE_DOMAIN_DEFAULTS[domain]
    const nextRecord = config?.records?.[0] ?? null

    // Compute status from next record
    const status: ComplianceStatus = computeDomainStatus(config?.isEnabled ?? true, nextRecord)

    return {
      id: config?.id ?? null,
      organizationId: orgId,
      schoolId: schoolId ?? null,
      domain,
      isEnabled: config?.isEnabled ?? true,
      customDeadlineMonth: config?.customDeadlineMonth ?? null,
      customDeadlineDay: config?.customDeadlineDay ?? null,
      notes: config?.notes ?? null,
      createdAt: config?.createdAt ?? null,
      updatedAt: config?.updatedAt ?? null,
      // Computed fields for UI
      meta,
      nextRecord,
      status,
    }
  })
}

function computeDomainStatus(
  isEnabled: boolean,
  nextRecord: { dueDate: Date; status: ComplianceStatus; outcome: ComplianceOutcome } | null
): ComplianceStatus {
  if (!isEnabled) return 'NOT_APPLICABLE'
  if (!nextRecord) return 'PENDING'

  const now = new Date()
  const daysUntilDue = Math.floor((nextRecord.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (nextRecord.outcome === 'PASSED') return 'CURRENT'
  if (daysUntilDue < 0) return 'OVERDUE'
  if (daysUntilDue <= 30) return 'DUE_SOON'
  return 'PENDING'
}

/**
 * Get a single domain config by ID.
 */
export async function getComplianceDomainConfigById(orgId: string, id: string) {
  return rawPrisma.complianceDomainConfig.findFirst({
    where: { id, organizationId: orgId },
    include: { records: { where: { deletedAt: null }, orderBy: { dueDate: 'asc' } } },
  })
}

/**
 * Partial update of a domain config.
 */
export async function updateComplianceDomainConfig(
  orgId: string,
  id: string,
  data: unknown
) {
  const parsed = UpdateDomainConfigSchema.parse(data)
  return rawPrisma.complianceDomainConfig.update({
    where: { id },
    data: {
      ...(parsed.isEnabled !== undefined && { isEnabled: parsed.isEnabled }),
      ...(parsed.customDeadlineMonth !== undefined && { customDeadlineMonth: parsed.customDeadlineMonth }),
      ...(parsed.customDeadlineDay !== undefined && { customDeadlineDay: parsed.customDeadlineDay }),
      ...(parsed.notes !== undefined && { notes: parsed.notes }),
    },
  })
}

// ─── Calendar Population ──────────────────────────────────────────────────────

/**
 * For each enabled domain config, compute due dates in the given year range
 * and upsert ComplianceRecord rows (idempotent).
 */
export async function populateComplianceCalendar(
  orgId: string,
  schoolYearStart: Date,
  schoolYearEnd: Date
) {
  // Get all domain configs for this org (including those without custom config)
  const configs = await rawPrisma.complianceDomainConfig.findMany({
    where: { organizationId: orgId, isEnabled: true },
  })

  // Also handle domains that have no row yet (defaults to enabled)
  const allDomains = COMPLIANCE_DOMAINS

  let createdCount = 0

  for (const domain of allDomains) {
    const config = configs.find((c) => c.domain === domain)
    const meta = COMPLIANCE_DOMAIN_DEFAULTS[domain]

    // Skip if explicitly disabled
    if (config && !config.isEnabled) continue

    // Get or create the config row (find-or-create to handle nullable schoolId)
    let configId: string
    if (config) {
      configId = config.id
    } else {
      const existingDefault = await rawPrisma.complianceDomainConfig.findFirst({
        where: { organizationId: orgId, schoolId: null, domain },
      })
      if (existingDefault) {
        configId = existingDefault.id
      } else {
        const newConfig = await rawPrisma.complianceDomainConfig.create({
          data: {
            organizationId: orgId,
            schoolId: null,
            domain,
            isEnabled: true,
          },
        })
        configId = newConfig.id
      }
    }

    const deadlineMonth = config?.customDeadlineMonth ?? meta.defaultMonth
    const deadlineDay = config?.customDeadlineDay ?? meta.defaultDay
    const schoolId = config?.schoolId ?? null

    // Check last completed record to determine if due this year
    const lastRecord = await rawPrisma.complianceRecord.findFirst({
      where: {
        organizationId: orgId,
        domainConfigId: configId,
        outcome: 'PASSED',
        deletedAt: null,
      },
      orderBy: { dueDate: 'desc' },
    })

    // Compute due dates in range based on frequency
    const dueDates = computeDueDates(
      schoolYearStart,
      schoolYearEnd,
      deadlineMonth,
      deadlineDay,
      meta.frequencyYears,
      lastRecord?.dueDate ?? null
    )

    for (const dueDate of dueDates) {
      const yearLabel = dueDate.getFullYear()
      const title = `${meta.label} ${yearLabel}`

      try {
        await rawPrisma.complianceRecord.upsert({
          where: {
            // We need a unique key — use a composite approach via findFirst + create
            // Since there's no @@unique on (orgId, domainConfigId, dueDate), we simulate idempotency
            // by checking existence first
            id: 'non-existent-id', // Force create path
          },
          create: {
            organizationId: orgId,
            domainConfigId: configId,
            schoolId,
            domain,
            title,
            dueDate,
            outcome: 'PENDING',
            status: computeStatusFromDueDate(dueDate),
          },
          update: {},
        })
        createdCount++
      } catch {
        // Record may already exist — check and skip
        const existing = await rawPrisma.complianceRecord.findFirst({
          where: {
            organizationId: orgId,
            domainConfigId: configId,
            dueDate,
            deletedAt: null,
          },
        })
        if (!existing) {
          await rawPrisma.complianceRecord.create({
            data: {
              organizationId: orgId,
              domainConfigId: configId,
              schoolId,
              domain,
              title,
              dueDate,
              outcome: 'PENDING',
              status: computeStatusFromDueDate(dueDate),
            },
          })
          createdCount++
        }
      }
    }
  }

  return createdCount
}

function computeDueDates(
  start: Date,
  end: Date,
  month: number, // 1-12
  day: number,   // 1-31
  frequencyYears: number,
  lastPassedDate: Date | null
): Date[] {
  const dates: Date[] = []

  // Determine start year
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  for (let year = startYear; year <= endYear; year++) {
    // For multi-year frequencies, check if this year is due
    if (frequencyYears > 1 && lastPassedDate) {
      const yearsSinceLast = year - lastPassedDate.getFullYear()
      if (yearsSinceLast < frequencyYears) continue
    }

    const dueDate = new Date(year, month - 1, day)

    // Only include if within range
    if (dueDate >= start && dueDate <= end) {
      dates.push(dueDate)
    }
  }

  return dates
}

function computeStatusFromDueDate(dueDate: Date): ComplianceStatus {
  const now = new Date()
  const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilDue < 0) return 'OVERDUE'
  if (daysUntilDue <= 30) return 'DUE_SOON'
  return 'PENDING'
}

// ─── Compliance Records ───────────────────────────────────────────────────────

export interface ComplianceRecordFilters {
  domain?: ComplianceDomain
  status?: ComplianceStatus
  schoolId?: string
  from?: Date
  to?: Date
}

/**
 * List compliance records with optional filters.
 */
export async function getComplianceRecords(orgId: string, filters?: ComplianceRecordFilters) {
  return rawPrisma.complianceRecord.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      ...(filters?.domain && { domain: filters.domain }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.schoolId && { schoolId: filters.schoolId }),
      ...(filters?.from || filters?.to
        ? {
            dueDate: {
              ...(filters.from && { gte: filters.from }),
              ...(filters.to && { lte: filters.to }),
            },
          }
        : {}),
    },
    include: {
      domainConfig: true,
      school: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: 'asc' },
  })
}

/**
 * Get a single compliance record by ID with full relations.
 */
export async function getComplianceRecordById(orgId: string, id: string) {
  return rawPrisma.complianceRecord.findFirst({
    where: { id, organizationId: orgId, deletedAt: null },
    include: {
      domainConfig: true,
      school: { select: { id: true, name: true } },
      generatedTicket: { select: { id: true, ticketNumber: true, status: true } },
    },
  })
}

/**
 * Update a compliance record (outcome, inspector, dates, notes, attachments).
 */
export async function updateComplianceRecord(orgId: string, id: string, data: unknown) {
  const parsed = UpdateRecordSchema.parse(data)

  // Recompute status based on outcome + dueDate
  const record = await rawPrisma.complianceRecord.findFirst({
    where: { id, organizationId: orgId },
  })
  if (!record) throw new Error('Record not found')

  let status = parsed.status ?? record.status
  if (parsed.outcome === 'PASSED') status = 'CURRENT'
  else if (parsed.outcome === 'FAILED' || parsed.outcome === 'CONDITIONAL_PASS') {
    status = computeStatusFromDueDate(record.dueDate)
  }

  return rawPrisma.complianceRecord.update({
    where: { id },
    data: {
      ...(parsed.outcome !== undefined && { outcome: parsed.outcome }),
      ...(parsed.inspectionDate !== undefined && {
        inspectionDate: parsed.inspectionDate ? new Date(parsed.inspectionDate) : null,
      }),
      ...(parsed.inspector !== undefined && { inspector: parsed.inspector }),
      ...(parsed.notes !== undefined && { notes: parsed.notes }),
      ...(parsed.attachments !== undefined && { attachments: parsed.attachments }),
      status,
    },
  })
}

// ─── Ticket Generation ────────────────────────────────────────────────────────

/**
 * Auto-generate a MaintenanceTicket work order from a compliance record.
 * Stores the generated ticket ID back on the ComplianceRecord.
 */
export async function generateComplianceTicket(
  orgId: string,
  recordId: string,
  submittedByUserId: string
) {
  const record = await rawPrisma.complianceRecord.findFirst({
    where: { id: recordId, organizationId: orgId, deletedAt: null },
    include: { domainConfig: true },
  })
  if (!record) throw new Error('Record not found')
  if (record.generatedTicketId) throw new Error('Ticket already generated for this compliance record')

  const meta = COMPLIANCE_DOMAIN_DEFAULTS[record.domain]
  const category = meta.category as MaintenanceCategory
  const specialty = CATEGORY_TO_SPECIALTY[category]
  const ticketNumber = await generateTicketNumber(orgId)

  const now = new Date()
  const daysUntilDue = Math.floor((record.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const priority = daysUntilDue < 14 ? 'URGENT' : daysUntilDue < 30 ? 'HIGH' : 'MEDIUM'

  const ticket = await rawPrisma.maintenanceTicket.create({
    data: {
      organizationId: orgId,
      ticketNumber,
      title: `Compliance: ${meta.label} – ${record.title}`,
      description: `Auto-generated from compliance record. Due: ${record.dueDate.toLocaleDateString()}`,
      status: 'BACKLOG',
      category,
      specialty,
      priority,
      submittedById: submittedByUserId,
      schoolId: record.schoolId,
      version: 1,
    },
  })

  const updatedRecord = await rawPrisma.complianceRecord.update({
    where: { id: recordId },
    data: { generatedTicketId: ticket.id },
    include: {
      domainConfig: true,
      school: { select: { id: true, name: true } },
      generatedTicket: { select: { id: true, ticketNumber: true, status: true } },
    },
  })

  return { ticket, record: updatedRecord }
}

/**
 * Auto-generate a remediation MaintenanceTicket from a FAILED compliance record.
 * Stores the remediation ticket ID back on the ComplianceRecord.
 * Only callable when record.outcome === 'FAILED'.
 */
export async function generateRemediationTicket(
  orgId: string,
  recordId: string,
  submittedByUserId: string
) {
  const record = await rawPrisma.complianceRecord.findFirst({
    where: { id: recordId, organizationId: orgId, deletedAt: null },
    include: { domainConfig: true },
  })
  if (!record) throw new Error('Record not found')
  if (record.outcome !== 'FAILED') throw new Error('Record must have FAILED outcome for remediation ticket')
  if (record.remediationTicketId) throw new Error('Remediation ticket already generated for this compliance record')

  const meta = COMPLIANCE_DOMAIN_DEFAULTS[record.domain]
  const category = meta.category as MaintenanceCategory
  const specialty = CATEGORY_TO_SPECIALTY[category]
  const ticketNumber = await generateTicketNumber(orgId)

  const inspectionDateStr = record.inspectionDate
    ? record.inspectionDate.toLocaleDateString()
    : 'unknown date'

  const ticket = await rawPrisma.maintenanceTicket.create({
    data: {
      organizationId: orgId,
      ticketNumber,
      title: `Remediation Required: ${meta.label} – ${record.title}`,
      description: `FAILED inspection on ${inspectionDateStr}. Remediation required. Auto-generated from compliance record.`,
      status: 'BACKLOG',
      category,
      specialty,
      priority: 'URGENT',
      submittedById: submittedByUserId,
      schoolId: record.schoolId,
      version: 1,
    },
  })

  const updatedRecord = await rawPrisma.complianceRecord.update({
    where: { id: recordId },
    data: { remediationTicketId: ticket.id },
    include: {
      domainConfig: true,
      school: { select: { id: true, name: true } },
      generatedTicket: { select: { id: true, ticketNumber: true, status: true } },
      remediationTicket: { select: { id: true, ticketNumber: true, status: true } },
    },
  })

  return { ticket, record: updatedRecord }
}

/**
 * Get compliance records for audit PDF export.
 * Returns all non-deleted records for the date range, sorted by domain ASC, dueDate ASC.
 */
export async function getComplianceRecordsForExport(
  orgId: string,
  filters: {
    from: Date
    to: Date
    schoolId?: string
    domain?: ComplianceDomain
  }
) {
  return rawPrisma.complianceRecord.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      dueDate: {
        gte: filters.from,
        lte: filters.to,
      },
      ...(filters.schoolId ? { schoolId: filters.schoolId } : {}),
      ...(filters.domain ? { domain: filters.domain } : {}),
    },
    include: {
      domainConfig: true,
      school: { select: { id: true, name: true } },
      generatedTicket: { select: { id: true, ticketNumber: true, status: true } },
      remediationTicket: { select: { id: true, ticketNumber: true, status: true } },
    },
    orderBy: [{ domain: 'asc' }, { dueDate: 'asc' }],
  })
}

// ─── Compliance Reminder Dispatch ─────────────────────────────────────────────

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
}

/**
 * Send 30-day and 7-day compliance reminders.
 * If orgId is provided, process just that org. Otherwise, process ALL orgs.
 * Used by cron endpoint.
 */
export async function sendComplianceReminders(orgId?: string): Promise<number> {
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  let totalSent = 0

  // Get orgs to process
  let orgIds: string[]
  if (orgId) {
    orgIds = [orgId]
  } else {
    const orgs = await rawPrisma.organization.findMany({ select: { id: true } })
    orgIds = orgs.map((o) => o.id)
  }

  for (const currentOrgId of orgIds) {
    try {
      // Get org name for email
      const org = await rawPrisma.organization.findUnique({
        where: { id: currentOrgId },
        select: { name: true },
      })
      if (!org) continue

      // Find records needing 7-day reminder
      const sevenDayRecords = await rawPrisma.complianceRecord.findMany({
        where: {
          organizationId: currentOrgId,
          remindedAt7Days: false,
          outcome: 'PENDING',
          dueDate: { lte: in7Days, gte: now },
          deletedAt: null,
        },
      })

      // Find records needing 30-day reminder (but not already within 7 days)
      const thirtyDayRecords = await rawPrisma.complianceRecord.findMany({
        where: {
          organizationId: currentOrgId,
          remindedAt30Days: false,
          outcome: 'PENDING',
          dueDate: { lte: in30Days, gte: in7Days },
          deletedAt: null,
        },
      })

      // Get heads + admins to notify
      const recipients = await getComplianceRecipients(currentOrgId)
      if (recipients.length === 0) continue

      const complianceLink = `${getAppUrl()}/maintenance/compliance`

      // Send 7-day reminders
      for (const record of sevenDayRecords) {
        const daysUntilDue = Math.max(0, Math.floor((record.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        const meta = COMPLIANCE_DOMAIN_DEFAULTS[record.domain]

        for (const recipient of recipients) {
          try {
            // Email
            await sendComplianceReminderEmail({
              to: recipient.email,
              recipientName: `${recipient.firstName} ${recipient.lastName}`.trim(),
              domain: meta.label,
              recordTitle: record.title,
              dueDate: record.dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
              daysUntilDue,
              orgName: org.name,
              complianceLink,
            })

            // In-app notification
            await createNotification({
              userId: recipient.id,
              type: 'compliance_reminder',
              title: `Compliance Due in ${daysUntilDue} days: ${meta.label}`,
              body: `${record.title} is due on ${record.dueDate.toLocaleDateString()}. Action required.`,
              linkUrl: complianceLink,
            })

            totalSent++
          } catch (err) {
            console.error(`[complianceService] Failed to send 7-day reminder to ${recipient.email}:`, err)
          }
        }

        // Mark as reminded
        await rawPrisma.complianceRecord.update({
          where: { id: record.id },
          data: { remindedAt7Days: true },
        })
      }

      // Send 30-day reminders
      for (const record of thirtyDayRecords) {
        const daysUntilDue = Math.max(0, Math.floor((record.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        const meta = COMPLIANCE_DOMAIN_DEFAULTS[record.domain]

        for (const recipient of recipients) {
          try {
            await sendComplianceReminderEmail({
              to: recipient.email,
              recipientName: `${recipient.firstName} ${recipient.lastName}`.trim(),
              domain: meta.label,
              recordTitle: record.title,
              dueDate: record.dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
              daysUntilDue,
              orgName: org.name,
              complianceLink,
            })

            await createNotification({
              userId: recipient.id,
              type: 'compliance_reminder',
              title: `Compliance Reminder: ${meta.label}`,
              body: `${record.title} is due in ${daysUntilDue} days. Review your compliance calendar.`,
              linkUrl: complianceLink,
            })

            totalSent++
          } catch (err) {
            console.error(`[complianceService] Failed to send 30-day reminder to ${recipient.email}:`, err)
          }
        }

        // Mark as reminded
        await rawPrisma.complianceRecord.update({
          where: { id: record.id },
          data: { remindedAt30Days: true },
        })
      }
    } catch (orgErr) {
      console.error(`[complianceService] Failed to process org ${currentOrgId}:`, orgErr)
    }
  }

  return totalSent
}

/**
 * Get maintenance heads and admins for compliance notifications.
 */
async function getComplianceRecipients(orgId: string) {
  const users = await rawPrisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      userRole: {
        slug: { in: ['maintenance-head', 'admin', 'super-admin'] },
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
