import { describe, it, expect } from 'vitest'
import {
  CONDITION_TYPES,
  ACTION_TYPES,
  NotificationRuleInputSchema,
} from '@/lib/types/notification-orchestration'

// ── Constants ─────────────────────────────────────────────────────────────────

describe('CONDITION_TYPES', () => {
  it('is a non-empty array', () => {
    expect(CONDITION_TYPES.length).toBeGreaterThan(0)
  })

  it('each entry has key and label', () => {
    for (const ct of CONDITION_TYPES) {
      expect(ct.key).toBeTruthy()
      expect(ct.label).toBeTruthy()
    }
  })

  it('includes registration_incomplete', () => {
    expect(CONDITION_TYPES.some((c) => c.key === 'registration_incomplete')).toBe(true)
  })
})

describe('ACTION_TYPES', () => {
  it('is a non-empty array', () => {
    expect(ACTION_TYPES.length).toBeGreaterThan(0)
  })

  it('each entry has key and label', () => {
    for (const at of ACTION_TYPES) {
      expect(at.key).toBeTruthy()
      expect(at.label).toBeTruthy()
    }
  })

  it('includes on_registration', () => {
    expect(ACTION_TYPES.some((a) => a.key === 'on_registration')).toBe(true)
  })
})

// ── NotificationRuleInputSchema ──────────────────────────────────────────────

describe('NotificationRuleInputSchema', () => {
  const validInput = {
    triggerType: 'DATE_BASED' as const,
    label: '7-Day Reminder',
    subject: 'Your event is coming up',
    messageBody: 'Reminder: the event starts in 7 days.',
  }

  it('accepts valid input', () => {
    const result = NotificationRuleInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects invalid triggerType', () => {
    const result = NotificationRuleInputSchema.safeParse({
      ...validInput,
      triggerType: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid trigger types', () => {
    for (const trigger of ['DATE_BASED', 'CONDITION_BASED', 'ACTION_TRIGGERED']) {
      const result = NotificationRuleInputSchema.safeParse({ ...validInput, triggerType: trigger })
      expect(result.success, `trigger=${trigger}`).toBe(true)
    }
  })

  it('rejects empty label', () => {
    const result = NotificationRuleInputSchema.safeParse({ ...validInput, label: '' })
    expect(result.success).toBe(false)
  })

  it('rejects label over 200 characters', () => {
    const result = NotificationRuleInputSchema.safeParse({ ...validInput, label: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects empty subject', () => {
    const result = NotificationRuleInputSchema.safeParse({ ...validInput, subject: '' })
    expect(result.success).toBe(false)
  })

  it('rejects subject over 500 characters', () => {
    const result = NotificationRuleInputSchema.safeParse({ ...validInput, subject: 'A'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('rejects empty messageBody', () => {
    const result = NotificationRuleInputSchema.safeParse({ ...validInput, messageBody: '' })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = NotificationRuleInputSchema.safeParse({
      ...validInput,
      offsetDays: 7,
      conditionType: 'registration_incomplete',
      targetAudience: 'registrants',
    })
    expect(result.success).toBe(true)
  })

  it('defaults targetAudience to "all"', () => {
    const result = NotificationRuleInputSchema.safeParse(validInput)
    if (result.success) {
      expect(result.data.targetAudience).toBe('all')
    }
  })
})
