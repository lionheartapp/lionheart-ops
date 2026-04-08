import { describe, it, expect } from 'vitest'
import {
  BUDGET_CATEGORY_PRESETS,
  BUDGET_REVENUE_SOURCES,
  BudgetLineItemInputSchema,
  BudgetRevenueInputSchema,
} from '@/lib/types/budget'

// ── Constants ─────────────────────────────────────────────────────────────────

describe('BUDGET_CATEGORY_PRESETS', () => {
  it('is a non-empty array', () => {
    expect(BUDGET_CATEGORY_PRESETS.length).toBeGreaterThan(0)
  })

  it('includes expected categories', () => {
    expect(BUDGET_CATEGORY_PRESETS).toContain('Venue')
    expect(BUDGET_CATEGORY_PRESETS).toContain('Transportation')
    expect(BUDGET_CATEGORY_PRESETS).toContain('Food & Catering')
    expect(BUDGET_CATEGORY_PRESETS).toContain('Miscellaneous')
  })

  it('has no duplicates', () => {
    const unique = new Set(BUDGET_CATEGORY_PRESETS)
    expect(unique.size).toBe(BUDGET_CATEGORY_PRESETS.length)
  })
})

describe('BUDGET_REVENUE_SOURCES', () => {
  it('includes expected sources', () => {
    expect(BUDGET_REVENUE_SOURCES).toContain('REGISTRATION_FEE')
    expect(BUDGET_REVENUE_SOURCES).toContain('SPONSORSHIP')
    expect(BUDGET_REVENUE_SOURCES).toContain('DONATION')
    expect(BUDGET_REVENUE_SOURCES).toContain('GRANT')
  })
})

// ── BudgetLineItemInputSchema ────────────────────────────────────────────────

describe('BudgetLineItemInputSchema', () => {
  it('accepts valid input', () => {
    const result = BudgetLineItemInputSchema.safeParse({
      categoryId: 'clxyz1234567890abcdef',
      description: 'Bus rental',
      budgetedAmount: 500,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing description', () => {
    const result = BudgetLineItemInputSchema.safeParse({
      categoryId: 'clxyz1234567890abcdef',
      budgetedAmount: 500,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative budgetedAmount', () => {
    const result = BudgetLineItemInputSchema.safeParse({
      categoryId: 'clxyz1234567890abcdef',
      description: 'Test',
      budgetedAmount: -100,
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields as null', () => {
    const result = BudgetLineItemInputSchema.safeParse({
      categoryId: 'clxyz1234567890abcdef',
      description: 'Test',
      budgetedAmount: 100,
      actualAmount: null,
      vendor: null,
      notes: null,
    })
    expect(result.success).toBe(true)
  })

  it('coerces string amount to number', () => {
    const result = BudgetLineItemInputSchema.safeParse({
      categoryId: 'clxyz1234567890abcdef',
      description: 'Test',
      budgetedAmount: '250',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.budgetedAmount).toBe(250)
    }
  })
})

// ── BudgetRevenueInputSchema ─────────────────────────────────────────────────

describe('BudgetRevenueInputSchema', () => {
  it('accepts valid input', () => {
    const result = BudgetRevenueInputSchema.safeParse({
      source: 'SPONSORSHIP',
      description: 'Local business sponsor',
      amount: 1000,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid source', () => {
    const result = BudgetRevenueInputSchema.safeParse({
      source: 'INVALID_SOURCE',
      description: 'Test',
      amount: 100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative amount', () => {
    const result = BudgetRevenueInputSchema.safeParse({
      source: 'DONATION',
      description: 'Test',
      amount: -50,
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = BudgetRevenueInputSchema.safeParse({
      source: 'GRANT',
      description: 'Federal grant',
      amount: 5000,
      receivedDate: null,
      notes: null,
    })
    expect(result.success).toBe(true)
  })
})
