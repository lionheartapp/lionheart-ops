import { describe, it, expect } from 'vitest'
import { validatePassword, passwordSchema, PASSWORD_RULES } from '@/lib/validation/password'

// ── PASSWORD_RULES ───────────────────────────────────────────────────────────

describe('PASSWORD_RULES', () => {
  it('has 4 rules', () => {
    expect(PASSWORD_RULES).toHaveLength(4)
  })

  it('includes length, uppercase, number, and special character rules', () => {
    const ids = PASSWORD_RULES.map((r) => r.id)
    expect(ids).toContain('length')
    expect(ids).toContain('uppercase')
    expect(ids).toContain('number')
    expect(ids).toContain('special')
  })

  describe('individual rule tests', () => {
    const getRule = (id: string) => PASSWORD_RULES.find((r) => r.id === id)!

    it('length: requires >= 8 characters', () => {
      expect(getRule('length').test('1234567')).toBe(false)
      expect(getRule('length').test('12345678')).toBe(true)
    })

    it('uppercase: requires at least one uppercase letter', () => {
      expect(getRule('uppercase').test('alllower')).toBe(false)
      expect(getRule('uppercase').test('hasUpper')).toBe(true)
    })

    it('number: requires at least one digit', () => {
      expect(getRule('number').test('NoDigits')).toBe(false)
      expect(getRule('number').test('Has1Digit')).toBe(true)
    })

    it('special: requires at least one special character', () => {
      expect(getRule('special').test('NoSpecial1')).toBe(false)
      expect(getRule('special').test('Special!')).toBe(true)
      expect(getRule('special').test('At@sign')).toBe(true)
      expect(getRule('special').test('Under_score')).toBe(true)
    })
  })
})

// ── validatePassword ─────────────────────────────────────────────────────────

describe('validatePassword', () => {
  it('returns valid: true for a strong password', () => {
    const { valid, results } = validatePassword('Str0ng!Pass')
    expect(valid).toBe(true)
    expect(results.every((r) => r.passed)).toBe(true)
  })

  it('returns valid: false for empty string', () => {
    const { valid } = validatePassword('')
    expect(valid).toBe(false)
  })

  it('returns valid: false for short password with all other rules met', () => {
    const { valid, results } = validatePassword('Ab1!')
    expect(valid).toBe(false)
    const lengthResult = results.find((r) => r.id === 'length')
    expect(lengthResult?.passed).toBe(false)
  })

  it('returns valid: false for password without uppercase', () => {
    const { valid, results } = validatePassword('lowercase1!')
    expect(valid).toBe(false)
    expect(results.find((r) => r.id === 'uppercase')?.passed).toBe(false)
  })

  it('returns valid: false for password without number', () => {
    const { valid, results } = validatePassword('NoNumber!!')
    expect(valid).toBe(false)
    expect(results.find((r) => r.id === 'number')?.passed).toBe(false)
  })

  it('returns valid: false for password without special char', () => {
    const { valid, results } = validatePassword('NoSpecial1')
    expect(valid).toBe(false)
    expect(results.find((r) => r.id === 'special')?.passed).toBe(false)
  })

  it('returns per-rule results with id, label, and passed', () => {
    const { results } = validatePassword('test')
    expect(results).toHaveLength(4)
    for (const r of results) {
      expect(r).toHaveProperty('id')
      expect(r).toHaveProperty('label')
      expect(r).toHaveProperty('passed')
    }
  })
})

// ── passwordSchema (Zod) ─────────────────────────────────────────────────────

describe('passwordSchema', () => {
  it('parses a strong password', () => {
    expect(() => passwordSchema.parse('Str0ng!Pass')).not.toThrow()
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
