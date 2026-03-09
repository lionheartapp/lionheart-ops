import { z } from 'zod'

// ─── Password Rules ────────────────────────────────────────────────────────

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { id: 'number', label: 'One number', test: (pw: string) => /[0-9]/.test(pw) },
  {
    id: 'special',
    label: 'One special character',
    test: (pw: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pw),
  },
] as const

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]['id']

export type PasswordRuleResult = {
  id: PasswordRuleId
  label: string
  passed: boolean
}

// ─── Validation Function ───────────────────────────────────────────────────

/**
 * Run all password rules and return per-rule results.
 */
export function validatePassword(password: string): {
  valid: boolean
  results: PasswordRuleResult[]
} {
  const results = PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(password),
  }))
  return {
    valid: results.every((r) => r.passed),
    results,
  }
}

// ─── Zod Schema ─────────────────────────────────────────────────────────────

export const passwordSchema = z
  .string()
  .min(8)
  .refine((pw) => PASSWORD_RULES.every((r) => r.test(pw)), {
    message:
      'Password must contain at least 8 characters, one uppercase letter, one number, and one special character',
  })
