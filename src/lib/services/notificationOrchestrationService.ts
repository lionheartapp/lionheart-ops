/**
 * Notification Orchestration Service — Phase 22
 *
 * Manages EventNotificationRule lifecycle:
 * - CRUD for rules (DATE_BASED, CONDITION_BASED, ACTION_TRIGGERED)
 * - Approval workflow (DRAFT → PENDING_APPROVAL → APPROVED → SENT)
 * - Automatic scheduledAt recalculation when events are rescheduled
 * - Cron-based dispatch of approved notifications
 */

import { prisma, rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { createBulkNotifications } from '@/lib/services/notificationService'
import * as twilioService from '@/lib/services/integrations/twilioService'
import type {
  NotificationRuleInput,
  NotificationRuleRow,
  RecalculateResult,
} from '@/lib/types/notification-orchestration'

const log = logger.child({ service: 'notificationOrchestrationService' })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function computeScheduledAt(startsAt: Date, offsetDays: number): Date {
  return addDays(startsAt, offsetDays)
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Returns all rules for an event project, sorted by scheduledAt (nulls last),
 * with approvedBy and createdBy user names.
 */
export async function getRules(eventProjectId: string): Promise<NotificationRuleRow[]> {
  const rules = await (prisma as any).eventNotificationRule.findMany({
    where: { eventProjectId },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    include: {
      approvedBy: { select: { name: true, firstName: true, lastName: true } },
      createdBy: { select: { name: true, firstName: true, lastName: true } },
    },
  })

  // Put nullScheduledAt rows last
  return rules.sort((a: NotificationRuleRow, b: NotificationRuleRow) => {
    if (a.scheduledAt === null && b.scheduledAt === null) return 0
    if (a.scheduledAt === null) return 1
    if (b.scheduledAt === null) return -1
    return 0
  })
}

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a rule. For DATE_BASED, computes scheduledAt from event's startsAt + offsetDays.
 * Status starts as DRAFT.
 */
export async function createRule(
  eventProjectId: string,
  input: NotificationRuleInput,
  userId: string
): Promise<NotificationRuleRow> {
  let scheduledAt: Date | undefined

  if (input.triggerType === 'DATE_BASED' && input.offsetDays !== undefined) {
    const event = await (prisma as any).eventProject.findFirst({
      where: { id: eventProjectId },
      select: { startsAt: true },
    })
    if (!event) throw new Error('EventProject not found')
    scheduledAt = computeScheduledAt(new Date(event.startsAt), input.offsetDays)
  }

  const rule = await (prisma as any).eventNotificationRule.create({
    data: {
      eventProjectId,
      triggerType: input.triggerType,
      label: input.label,
      offsetDays: input.offsetDays ?? null,
      conditionType: input.conditionType ?? null,
      conditionThresholdDays: input.conditionThresholdDays ?? null,
      actionType: input.actionType ?? null,
      targetAudience: input.targetAudience ?? 'all',
      subject: input.subject,
      messageBody: input.messageBody,
      scheduledAt: scheduledAt ?? null,
      status: 'DRAFT',
      createdById: userId,
    },
    include: {
      approvedBy: { select: { name: true, firstName: true, lastName: true } },
      createdBy: { select: { name: true, firstName: true, lastName: true } },
    },
  })

  return rule as NotificationRuleRow
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Updates rule fields. Only allowed when status is DRAFT or PENDING_APPROVAL.
 * If offsetDays changes on a DATE_BASED rule, recomputes scheduledAt.
 */
export async function updateRule(
  ruleId: string,
  input: Partial<NotificationRuleInput>
): Promise<NotificationRuleRow> {
  const existing = await (prisma as any).eventNotificationRule.findFirst({
    where: { id: ruleId },
    include: { eventProject: { select: { startsAt: true } } },
  })

  if (!existing) throw new Error('Notification rule not found')
  if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot update rule in status: ${existing.status}`)
  }

  const updateData: Record<string, unknown> = {}

  if (input.label !== undefined) updateData.label = input.label
  if (input.triggerType !== undefined) updateData.triggerType = input.triggerType
  if (input.targetAudience !== undefined) updateData.targetAudience = input.targetAudience
  if (input.subject !== undefined) updateData.subject = input.subject
  if (input.messageBody !== undefined) updateData.messageBody = input.messageBody
  if (input.conditionType !== undefined) updateData.conditionType = input.conditionType
  if (input.conditionThresholdDays !== undefined) updateData.conditionThresholdDays = input.conditionThresholdDays
  if (input.actionType !== undefined) updateData.actionType = input.actionType

  // Recompute scheduledAt if offsetDays changes on DATE_BASED rule
  if (input.offsetDays !== undefined) {
    updateData.offsetDays = input.offsetDays
    const effectiveTriggerType = input.triggerType ?? existing.triggerType
    if (effectiveTriggerType === 'DATE_BASED' && existing.eventProject?.startsAt) {
      updateData.scheduledAt = computeScheduledAt(
        new Date(existing.eventProject.startsAt),
        input.offsetDays
      )
    }
  }

  const updated = await (prisma as any).eventNotificationRule.update({
    where: { id: ruleId },
    data: updateData,
    include: {
      approvedBy: { select: { name: true, firstName: true, lastName: true } },
      createdBy: { select: { name: true, firstName: true, lastName: true } },
    },
  })

  return updated as NotificationRuleRow
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Hard deletes rule. Only allowed when status is DRAFT.
 */
export async function deleteRule(ruleId: string): Promise<void> {
  const existing = await (prisma as any).eventNotificationRule.findFirst({
    where: { id: ruleId },
    select: { status: true },
  })

  if (!existing) throw new Error('Notification rule not found')
  if (existing.status !== 'DRAFT') {
    throw new Error(`Cannot delete rule in status: ${existing.status}. Only DRAFT rules can be deleted.`)
  }

  await rawPrisma.eventNotificationRule.delete({ where: { id: ruleId } } as any)
}

// ─── Approval workflow ────────────────────────────────────────────────────────

/** Submit rule for approval. Transitions DRAFT → PENDING_APPROVAL. */
export async function submitForApproval(ruleId: string): Promise<NotificationRuleRow> {
  const existing = await (prisma as any).eventNotificationRule.findFirst({
    where: { id: ruleId },
    select: { status: true },
  })

  if (!existing) throw new Error('Notification rule not found')
  if (existing.status !== 'DRAFT') {
    throw new Error(`Cannot submit rule in status: ${existing.status}`)
  }

  const updated = await (prisma as any).eventNotificationRule.update({
    where: { id: ruleId },
    data: { status: 'PENDING_APPROVAL' },
    include: {
      approvedBy: { select: { name: true, firstName: true, lastName: true } },
      createdBy: { select: { name: true, firstName: true, lastName: true } },
    },
  })

  return updated as NotificationRuleRow
}

/** Approve rule. Transitions PENDING_APPROVAL → APPROVED. For DATE_BASED, scheduledAt must be in future. */
export async function approveRule(ruleId: string, userId: string): Promise<NotificationRuleRow> {
  const existing = await (prisma as any).eventNotificationRule.findFirst({
    where: { id: ruleId },
    select: { status: true, triggerType: true, scheduledAt: true },
  })

  if (!existing) throw new Error('Notification rule not found')
  if (existing.status !== 'PENDING_APPROVAL') {
    throw new Error(`Cannot approve rule in status: ${existing.status}`)
  }

  if (existing.triggerType === 'DATE_BASED' && existing.scheduledAt) {
    if (new Date(existing.scheduledAt) <= new Date()) {
      throw new Error('Cannot approve rule: scheduled time is in the past')
    }
  }

  const updated = await (prisma as any).eventNotificationRule.update({
    where: { id: ruleId },
    data: {
      status: 'APPROVED',
      approvedById: userId,
      approvedAt: new Date(),
    },
    include: {
      approvedBy: { select: { name: true, firstName: true, lastName: true } },
      createdBy: { select: { name: true, firstName: true, lastName: true } },
    },
  })

  return updated as NotificationRuleRow
}

/** Cancel rule. Transitions any non-SENT status → CANCELLED. */
export async function cancelRule(ruleId: string): Promise<NotificationRuleRow> {
  const existing = await (prisma as any).eventNotificationRule.findFirst({
    where: { id: ruleId },
    select: { status: true },
  })

  if (!existing) throw new Error('Notification rule not found')
  if (existing.status === 'SENT') {
    throw new Error('Cannot cancel a rule that has already been sent')
  }

  const updated = await (prisma as any).eventNotificationRule.update({
    where: { id: ruleId },
    data: { status: 'CANCELLED' },
    include: {
      approvedBy: { select: { name: true, firstName: true, lastName: true } },
      createdBy: { select: { name: true, firstName: true, lastName: true } },
    },
  })

  return updated as NotificationRuleRow
}

// ─── Reschedule adjustment ────────────────────────────────────────────────────

/**
 * Called when an event is rescheduled.
 * Recomputes scheduledAt for all DATE_BASED rules in DRAFT, PENDING_APPROVAL, or APPROVED status.
 * Returns summary of changes.
 */
export async function recalculateRulesForEvent(
  eventProjectId: string
): Promise<RecalculateResult[]> {
  const event = await (prisma as any).eventProject.findFirst({
    where: { id: eventProjectId },
    select: { startsAt: true },
  })

  if (!event) throw new Error('EventProject not found')

  const newStartsAt = new Date(event.startsAt)

  const rules = await (prisma as any).eventNotificationRule.findMany({
    where: {
      eventProjectId,
      triggerType: 'DATE_BASED',
      status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
      offsetDays: { not: null },
    },
    select: { id: true, label: true, offsetDays: true, scheduledAt: true },
  })

  const results: RecalculateResult[] = []

  for (const rule of rules) {
    const oldScheduledAt = rule.scheduledAt ? new Date(rule.scheduledAt) : null
    const newScheduledAt = computeScheduledAt(newStartsAt, rule.offsetDays as number)

    await (prisma as any).eventNotificationRule.update({
      where: { id: rule.id },
      data: { scheduledAt: newScheduledAt },
    })

    results.push({
      ruleId: rule.id,
      label: rule.label as string,
      oldScheduledAt,
      newScheduledAt,
    })
  }

  return results
}

// ─── Audience resolution ──────────────────────────────────────────────────────

type Recipient = { userId: string; email: string; name: string }

/**
 * Resolves a targetAudience string to a list of recipients.
 * Uses rawPrisma since this runs in cron context (cross-org).
 */
async function resolveAudience(
  eventProjectId: string,
  targetAudience: string,
  orgId: string
): Promise<Recipient[]> {
  if (targetAudience === 'all' || targetAudience === 'registered') {
    // All confirmed registrants for the event
    const registrations = await rawPrisma.eventRegistration.findMany({
      where: {
        eventProjectId,
        organizationId: orgId,
        status: targetAudience === 'registered' ? 'CONFIRMED' : { not: 'CANCELLED' },
      },
      select: {
        id: true,
        registrantEmail: true,
        registrantName: true,
        userId: true,
      },
    } as any)

    return (registrations as any[])
      .filter((r: any) => r.userId)
      .map((r: any) => ({
        userId: r.userId as string,
        email: r.registrantEmail as string,
        name: r.registrantName as string || 'Participant',
      }))
  }

  if (targetAudience.startsWith('group:')) {
    const groupId = targetAudience.replace('group:', '')
    const assignments = await rawPrisma.eventGroupAssignment.findMany({
      where: {
        groupId,
        organizationId: orgId,
      },
      select: {
        registration: {
          select: {
            userId: true,
            registrantEmail: true,
            registrantName: true,
          },
        },
      },
    } as any)

    return (assignments as any[])
      .filter((a: any) => a.registration?.userId)
      .map((a: any) => ({
        userId: a.registration.userId as string,
        email: a.registration.registrantEmail as string,
        name: a.registration.registrantName as string || 'Participant',
      }))
  }

  if (targetAudience === 'incomplete_docs') {
    const registrations = await rawPrisma.eventRegistration.findMany({
      where: {
        eventProjectId,
        organizationId: orgId,
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        userId: true,
        registrantEmail: true,
        registrantName: true,
        documentCompletions: {
          select: { isComplete: true },
        },
      },
    } as any)

    return (registrations as any[])
      .filter((r: any) => {
        const completions = r.documentCompletions || []
        const hasIncomplete = completions.some((c: any) => !c.isComplete)
        return r.userId && hasIncomplete
      })
      .map((r: any) => ({
        userId: r.userId as string,
        email: r.registrantEmail as string,
        name: r.registrantName as string || 'Participant',
      }))
  }

  if (targetAudience === 'unpaid') {
    const registrations = await rawPrisma.eventRegistration.findMany({
      where: {
        eventProjectId,
        organizationId: orgId,
        status: { not: 'CANCELLED' },
        paymentStatus: { not: 'PAID' },
      },
      select: {
        id: true,
        userId: true,
        registrantEmail: true,
        registrantName: true,
      },
    } as any)

    return (registrations as any[])
      .filter((r: any) => r.userId)
      .map((r: any) => ({
        userId: r.userId as string,
        email: r.registrantEmail as string,
        name: r.registrantName as string || 'Participant',
      }))
  }

  log.warn({ targetAudience }, 'Unknown target audience — returning empty list')
  return []
}

// ─── Phone resolution ─────────────────────────────────────────────────────────

/**
 * Resolves phone numbers for a list of recipient userIds.
 * Returns only recipients who have a phone number on their User record.
 */
async function resolvePhoneNumbers(
  recipients: Recipient[]
): Promise<Array<{ to: string; body: string }>> {
  const userIds = recipients.map((r) => r.userId)
  const users = await rawPrisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, phone: true },
  } as any)

  const phoneMap = new Map(
    (users as Array<{ id: string; phone: string | null }>)
      .filter((u) => u.phone)
      .map((u) => [u.id, u.phone as string])
  )

  return recipients
    .filter((r) => phoneMap.has(r.userId))
    .map((r) => ({ to: phoneMap.get(r.userId)!, body: '' }))
}

// ─── Cron dispatch ────────────────────────────────────────────────────────────

/**
 * Called by cron. Finds all rules where status=APPROVED AND scheduledAt <= now() AND sentAt IS NULL.
 * Dispatches in-app notifications and fire-and-forget email.
 * Returns count of dispatched rules.
 */
export async function dispatchPendingNotifications(): Promise<number> {
  const now = new Date()

  const rules = await rawPrisma.eventNotificationRule.findMany({
    where: {
      status: 'APPROVED',
      scheduledAt: { lte: now },
      sentAt: null,
    },
    select: {
      id: true,
      organizationId: true,
      eventProjectId: true,
      subject: true,
      messageBody: true,
      targetAudience: true,
    },
  } as any)

  if ((rules as any[]).length === 0) return 0

  let dispatched = 0

  for (const rule of rules as any[]) {
    try {
      // Resolve recipients
      const recipients = await resolveAudience(
        rule.eventProjectId,
        rule.targetAudience,
        rule.organizationId
      )

      const recipientCount = recipients.length

      // In-app notifications
      if (recipients.length > 0) {
        await createBulkNotifications(
          recipients.map((r) => ({
            userId: r.userId,
            type: 'event_updated' as const, // using existing type as closest match
            title: rule.subject,
            body: rule.messageBody,
          }))
        )
      }

      // SMS delivery — check if org has active Twilio integration
      try {
        const smsAvailable = await twilioService.isAvailable(rule.organizationId)
        if (smsAvailable && recipients.length > 0) {
          const smsMessage = `${rule.subject}\n\n${rule.messageBody}`
          const smsRecipients = await resolvePhoneNumbers(recipients)
          if (smsRecipients.length > 0) {
            const smsRecipientsWithBody = smsRecipients.map((r) => ({
              to: r.to,
              body: smsMessage,
            }))
            // Fire-and-forget — SMS failures are non-fatal
            twilioService
              .sendBulkSMS(rule.organizationId, smsRecipientsWithBody)
              .catch((err: unknown) => {
                log.error({ err, ruleId: rule.id }, 'SMS delivery failed — non-fatal')
              })
          }
        }
      } catch (smsErr) {
        // SMS failures are logged but do not block in-app dispatch
        log.error({ smsErr, ruleId: rule.id }, 'SMS check failed — non-fatal')
      }

      // Mark rule as sent and create log
      await rawPrisma.$transaction([
        (rawPrisma as any).eventNotificationRule.update({
          where: { id: rule.id },
          data: { sentAt: now, status: 'SENT' },
        }),
        (rawPrisma as any).eventNotificationLog.create({
          data: {
            organizationId: rule.organizationId,
            ruleId: rule.id,
            recipientCount,
            channel: 'in_app',
            sentAt: now,
          },
        }),
      ])

      dispatched++
    } catch (err) {
      log.error({ err, ruleId: rule.id }, 'Failed to dispatch notification rule')
      // Continue with next rule — non-fatal
    }
  }

  return dispatched
}
