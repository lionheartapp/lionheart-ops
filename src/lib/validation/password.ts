import { z } from 'zod'

// ─── Password Rules (NIST 800-63B compliant) ──────────────────────────────
// No composition rules (uppercase, digit, symbol) — NIST explicitly discourages
// them because they lead to predictable patterns like "Password1!".
// Instead: enforce minimum length and screen against known breached passwords.

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { id: 'max-length', label: 'No more than 64 characters', test: (pw: string) => pw.length <= 64 },
  { id: 'not-common', label: 'Not a commonly used password', test: (pw: string) => !COMMON_PASSWORDS.has(pw.toLowerCase()) },
] as const

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]['id']

export type PasswordRuleResult = {
  id: PasswordRuleId
  label: string
  passed: boolean
}

// ─── Common Passwords Blocklist ───────────────────────────────────────────
// Top passwords that get cracked instantly — blocked client-side immediately.
// Full breach checking happens server-side via HaveIBeenPwned.

const COMMON_PASSWORDS = new Set([
  'password', '12345678', '123456789', '1234567890', 'qwerty123',
  'password1', 'iloveyou', 'sunshine1', 'princess1', 'football1',
  'charlie1', 'access14', 'letmein1', 'trustno1', 'dragon12',
  'master12', 'monkey12', 'shadow12', 'abc12345', 'mustang1',
  'michael1', 'jennifer', 'jordan23', 'superman', 'harley12',
  'password123', 'welcome1', 'qwerty12', 'baseball1', 'starwars',
])

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
  .min(8, 'Password must be at least 8 characters')
  .max(64, 'Password must be 64 characters or fewer')
  .refine((pw) => !COMMON_PASSWORDS.has(pw.toLowerCase()), {
    message: 'This password is too common. Please choose something less predictable.',
  })

// Breach checking lives in ./password-breach-check.ts (server-only)
// Import { isPasswordBreached } from '@/lib/validation/password-breach-check'
