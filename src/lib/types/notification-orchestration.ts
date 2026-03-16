import { z } from 'zod'

// ─── Trigger type constants ───────────────────────────────────────────────────

export const CONDITION_TYPES: { key: string; label: string }[] = [
  { key: 'registration_incomplete', label: 'Registration not complete' },
  { key: 'documents_incomplete', label: 'Documents not signed' },
  { key: 'payment_pending', label: 'Payment not received' },
]

export const ACTION_TYPES: { key: string; label: string }[] = [
  { key: 'on_registration', label: 'When someone registers' },
  { key: 'on_group_assignment', label: 'When assigned to a group' },
  { key: 'on_checkin', label: 'When checked in' },
]

// ─── Zod schema ───────────────────────────────────────────────────────────────

export const NotificationRuleInputSchema = z.object({
  triggerType: z.enum(['DATE_BASED', 'CONDITION_BASED', 'ACTION_TRIGGERED']),
  label: z.string().min(1, 'Label is required').max(200),
  offsetDays: z.number().int().optional(),
  conditionType: z.string().optional(),
  conditionThresholdDays: z.number().int().optional(),
  actionType: z.string().optional(),
  targetAudience: z.string().default('all'),
  subject: z.string().min(1, 'Subject is required').max(500),
  messageBody: z.string().min(1, 'Message body is required'),
})

export type NotificationRuleInput = z.infer<typeof NotificationRuleInputSchema>

// ─── Response types ────────────────────────────────────────────────────────────

export type NotificationRuleRow = {
  id: string
  organizationId: string
  eventProjectId: string
  triggerType: 'DATE_BASED' | 'CONDITION_BASED' | 'ACTION_TRIGGERED'
  label: string
  offsetDays: number | null
  conditionType: string | null
  conditionThresholdDays: number | null
  actionType: string | null
  targetAudience: string
  subject: string
  messageBody: string
  isAIDrafted: boolean
  scheduledAt: Date | null
  sentAt: Date | null
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'CANCELLED'
  approvedById: string | null
  approvedAt: Date | null
  createdById: string
  createdAt: Date
  updatedAt: Date
  approvedBy?: { name: string | null; firstName: string | null; lastName: string | null } | null
  createdBy?: { name: string | null; firstName: string | null; lastName: string | null }
}

export type RecalculateResult = {
  ruleId: string
  label: string
  oldScheduledAt: Date | null
  newScheduledAt: Date | null
}
