import { describe, it, expect } from 'vitest'
import { validatePassword, passwordSchema, PASSWORD_RULES } from '@/lib/validation/password'

// ── PASSWORD_RULES ───────────────────────────────────────────────────────────

describe('PASSWORD_RULES', () => {
  it('has 3 rules (NIST 800-63B compliant)', () => {
    expect(PASSWORD_RULES).toHaveLength(3)
  })

  it('includes length, max-length, and not-common rules', () => {
    const ids = PASSWORD_RULES.map((r) => r.id)
    expect(ids).toContain('length')
    expect(ids).toContain('max-length')
    expect(ids).toContain('not-common')
  })

  describe('individual rule tests', () => {
    const getRule = (id: string) => PASSWORD_RULES.find((r) => r.id === id)!

    it('length: requires >= 8 characters', () => {
      expect(getRule('length').test('1234567')).toBe(false)
      expect(getRule('length').test('12345678')).toBe(true)
    })

    it('max-length: rejects > 64 characters', () => {
      expect(getRule('max-length').test('a'.repeat(64))).toBe(true)
      expect(getRule('max-length').test('a'.repeat(65))).toBe(false)
    })

    it('not-common: rejects commonly used passwords', () => {
      expect(getRule('not-common').test('password')).toBe(false)
      expect(getRule('not-common').test('12345678')).toBe(false)
      expect(getRule('not-common').test('uniquephrase')).toBe(true)
    })
  })
})

// ── validatePassword ─────────────────────────────────────────────────────────

describe('validatePassword', () => {
  it('returns valid: true for a good password', () => {
    const { valid, results } = validatePassword('myUniquePassphrase')
    expect(valid).toBe(true)
    expect(results.every((r) => r.passed)).toBe(true)
  })

  it('returns valid: false for empty string', () => {
    const { valid } = validatePassword('')
    expect(valid).toBe(false)
  })

  it('returns valid: false for short password', () => {
    const { valid, results } = validatePassword('short')
    expect(valid).toBe(false)
    const lengthResult = results.find((r) => r.id === 'length')
    expect(lengthResult?.passed).toBe(false)
  })

  it('returns valid: false for common password', () => {
    const { valid, results } = validatePassword('password')
    expect(valid).toBe(false)
    expect(results.find((r) => r.id === 'not-common')?.passed).toBe(false)
  })

  it('returns valid: false for overly long password', () => {
    const { valid, results } = validatePassword('a'.repeat(65))
    expect(valid).toBe(false)
    expect(results.find((r) => r.id === 'max-length')?.passed).toBe(false)
  })

  it('returns per-rule results with id, label, and passed', () => {
    const { results } = validatePassword('test')
    expect(results).toHaveLength(3)
    for (const r of results) {
      expect(r).toHaveProperty('id')
      expect(r).toHaveProperty('label')
      expect(r).toHaveProperty('passed')
    }
  })
})

// ── passwordSchema (Zod) ─────────────────────────────────────────────────────

describe('passwordSchema', () => {
  it('parses a good password', () => {
    expect(() => passwordSchema.parse('myUniquePassphrase')).not.toThrow()
  })

  it('rejects a weak password', () => {
    expect(() => passwordSchema.parse('weak')).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => passwordSchema.parse('')).toThrow()
  })

  it('rejects non-string input', () => {
    expect(() => passwordSchema.parse(12345678)).toThrow()
  })
})
