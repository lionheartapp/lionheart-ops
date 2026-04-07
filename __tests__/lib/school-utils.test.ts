import { describe, it, expect } from 'vitest'
import {
  formatPhoneInput,
  normalizeExtensionInput,
  normalizeSearchText,
  splitSearchTokens,
  matchesWordPrefixSequence,
  isValidPhoneValue,
  GRADE_LEVEL_DEFAULTS,
  COLOR_PRESETS,
  EMPTY_FORM,
} from '@/lib/school-utils'

// ── formatPhoneInput ────────────────────────────────────────────────────────

describe('formatPhoneInput', () => {
  it('returns empty for empty input', () => {
    expect(formatPhoneInput('')).toBe('')
  })

  it('formats 3 digits with opening paren', () => {
    expect(formatPhoneInput('555')).toBe('(555')
  })

  it('formats 6 digits with area code + space', () => {
    expect(formatPhoneInput('555123')).toBe('(555) 123')
  })

  it('formats 10 digits as full US phone number', () => {
    expect(formatPhoneInput('5551234567')).toBe('(555) 123-4567')
  })

  it('strips non-digit characters', () => {
    expect(formatPhoneInput('(555) 123-4567')).toBe('(555) 123-4567')
  })

  it('truncates to 10 digits', () => {
    expect(formatPhoneInput('55512345678')).toBe('(555) 123-4567')
  })

  it('handles partial input', () => {
    expect(formatPhoneInput('5')).toBe('(5')
    expect(formatPhoneInput('55')).toBe('(55')
    expect(formatPhoneInput('5551')).toBe('(555) 1')
  })
})

// ── normalizeExtensionInput ─────────────────────────────────────────────────

describe('normalizeExtensionInput', () => {
  it('strips non-digit characters', () => {
    expect(normalizeExtensionInput('ext 123')).toBe('123')
  })

  it('limits to 6 digits', () => {
    expect(normalizeExtensionInput('1234567890')).toBe('123456')
  })

  it('returns empty for non-numeric input', () => {
    expect(normalizeExtensionInput('abc')).toBe('')
  })
})

// ── normalizeSearchText ─────────────────────────────────────────────────────

describe('normalizeSearchText', () => {
  it('lowercases and trims', () => {
    expect(normalizeSearchText('  Hello World  ')).toBe('hello world')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeSearchText('a   b    c')).toBe('a b c')
  })
})

// ── splitSearchTokens ───────────────────────────────────────────────────────

describe('splitSearchTokens', () => {
  it('splits normalized text into tokens', () => {
    expect(splitSearchTokens('John Smith')).toEqual(['john', 'smith'])
  })

  it('returns empty array for empty/whitespace input', () => {
    expect(splitSearchTokens('')).toEqual([])
    expect(splitSearchTokens('   ')).toEqual([])
  })
})

// ── matchesWordPrefixSequence ───────────────────────────────────────────────

describe('matchesWordPrefixSequence', () => {
  it('matches full first name', () => {
    expect(matchesWordPrefixSequence('John Smith', 'john')).toBe(true)
  })

  it('matches prefix of first name', () => {
    expect(matchesWordPrefixSequence('John Smith', 'jo')).toBe(true)
  })

  it('matches first + last name prefixes', () => {
    expect(matchesWordPrefixSequence('John Smith', 'jo sm')).toBe(true)
  })

  it('matches last name prefix alone', () => {
    expect(matchesWordPrefixSequence('John Smith', 'sm')).toBe(true)
  })

  it('does not match mid-word', () => {
    expect(matchesWordPrefixSequence('John Smith', 'ohn')).toBe(false)
  })

  it('returns false for empty query', () => {
    expect(matchesWordPrefixSequence('John Smith', '')).toBe(false)
  })

  it('returns false when query has more tokens than name', () => {
    expect(matchesWordPrefixSequence('John', 'john smith')).toBe(false)
  })

  it('handles multi-word names', () => {
    expect(matchesWordPrefixSequence('Mary Jane Watson', 'ja wa')).toBe(true)
    expect(matchesWordPrefixSequence('Mary Jane Watson', 'ma wa')).toBe(true)
  })

  it('preserves token order (cannot match backwards)', () => {
    expect(matchesWordPrefixSequence('John Smith', 'sm jo')).toBe(false)
  })
})

// ── isValidPhoneValue ───────────────────────────────────────────────────────

describe('isValidPhoneValue', () => {
  it('returns true for 10-digit phone', () => {
    expect(isValidPhoneValue('(555) 123-4567')).toBe(true)
  })

  it('returns true for raw 10-digit string', () => {
    expect(isValidPhoneValue('5551234567')).toBe(true)
  })

  it('returns false for too-short number', () => {
    expect(isValidPhoneValue('555123')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidPhoneValue('')).toBe(false)
  })

  it('allows international numbers up to 15 digits', () => {
    expect(isValidPhoneValue('+1-555-123-4567')).toBe(true) // 11 digits
    expect(isValidPhoneValue('1234567890123456')).toBe(false) // 16 digits
  })
})

// ── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('GRADE_LEVEL_DEFAULTS has 3 entries', () => {
    expect(Object.keys(GRADE_LEVEL_DEFAULTS)).toHaveLength(3)
    expect(GRADE_LEVEL_DEFAULTS).toHaveProperty('ELEMENTARY')
    expect(GRADE_LEVEL_DEFAULTS).toHaveProperty('MIDDLE_SCHOOL')
    expect(GRADE_LEVEL_DEFAULTS).toHaveProperty('HIGH_SCHOOL')
  })

  it('COLOR_PRESETS has 10 entries', () => {
    expect(COLOR_PRESETS).toHaveLength(10)
  })

  it('each COLOR_PRESET has name and value', () => {
    for (const preset of COLOR_PRESETS) {
      expect(preset).toHaveProperty('name')
      expect(preset).toHaveProperty('value')
      expect(preset.value).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('EMPTY_FORM has correct defaults', () => {
    expect(EMPTY_FORM.name).toBe('')
    expect(EMPTY_FORM.gradeLevel).toBe('ELEMENTARY')
    expect(EMPTY_FORM.color).toBe('#a855f7')
  })
})
