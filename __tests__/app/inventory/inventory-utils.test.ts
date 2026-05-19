import { describe, it, expect } from 'vitest'
import {
  getStockStatus,
  formatActorName,
  formatDate,
} from '@/app/(app)/inventory/inventory-utils'
import type { InventoryItem, TransactionActor } from '@/app/(app)/inventory/inventory-types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1',
    name: 'Test Item',
    description: null,
    category: null,
    sku: null,
    quantityOnHand: 10,
    reorderThreshold: 5,
    ownerId: null,
    manufacturer: null,
    model: null,
    serialNumbers: [],
    tags: [],
    allowCheckout: false,
    imageUrl: null,
    locations: null,
    documentationLinks: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

// ── getStockStatus ──────────────────────────────────────────────────────────

describe('getStockStatus', () => {
  it('returns "in-stock" when quantity is above threshold', () => {
    expect(getStockStatus(makeItem({ quantityOnHand: 10, reorderThreshold: 5 }))).toBe('in-stock')
  })

  it('returns "low-stock" when quantity equals threshold', () => {
    expect(getStockStatus(makeItem({ quantityOnHand: 5, reorderThreshold: 5 }))).toBe('low-stock')
  })

  it('returns "low-stock" when quantity is below threshold but above zero', () => {
    expect(getStockStatus(makeItem({ quantityOnHand: 3, reorderThreshold: 5 }))).toBe('low-stock')
  })

  it('returns "out-of-stock" when quantity is zero', () => {
    expect(getStockStatus(makeItem({ quantityOnHand: 0, reorderThreshold: 5 }))).toBe('out-of-stock')
  })

  it('returns "in-stock" when threshold is 0 and quantity is positive', () => {
    expect(getStockStatus(makeItem({ quantityOnHand: 1, reorderThreshold: 0 }))).toBe('in-stock')
  })
})

// ── formatActorName ─────────────────────────────────────────────────────────

describe('formatActorName', () => {
  it('returns full name when both first and last are present', () => {
    const actor: TransactionActor = { id: '1', firstName: 'John', lastName: 'Smith', email: 'john@test.com' }
    expect(formatActorName(actor)).toBe('John Smith')
  })

  it('returns first name only when last name is null', () => {
    const actor: TransactionActor = { id: '1', firstName: 'John', lastName: null, email: 'john@test.com' }
    expect(formatActorName(actor)).toBe('John')
  })

  it('returns email when both names are null', () => {
    const actor: TransactionActor = { id: '1', firstName: null, lastName: null, email: 'john@test.com' }
    expect(formatActorName(actor)).toBe('john@test.com')
  })

  it('returns "Unknown" for null actor', () => {
    expect(formatActorName(null)).toBe('Unknown')
  })
})

// ── formatDate ──────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a valid date string', () => {
    const result = formatDate('2026-04-07T12:00:00Z')
    expect(result).toMatch(/Apr/)
    expect(result).toMatch(/7/)
    expect(result).toMatch(/2026/)
  })

  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('\u2014')
  })
})
