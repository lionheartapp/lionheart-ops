/**
 * Budget Types — Phase 22
 *
 * Client-safe types, Zod validation schemas, and constants for the
 * event budget feature. Used by budgetService.ts and API routes.
 */

import { z } from 'zod'

// ─── Category Presets ─────────────────────────────────────────────────────────

/** Preset budget category names seeded on first access of an event's budget. */
export const BUDGET_CATEGORY_PRESETS: string[] = [
  'Venue',
  'Transportation',
  'Food & Catering',
  'Supplies & Materials',
  'Insurance',
  'Staffing',
  'Equipment Rental',
  'Printing & Signage',
  'Entertainment',
  'Miscellaneous',
]

// ─── Enums ────────────────────────────────────────────────────────────────────

export const BUDGET_REVENUE_SOURCES = [
  'REGISTRATION_FEE',
  'SPONSORSHIP',
  'FUNDRAISING',
  'DONATION',
  'GRANT',
  'OTHER',
] as const

export type BudgetRevenueSource = (typeof BUDGET_REVENUE_SOURCES)[number]

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

/** Input schema for creating or updating a budget line item. */
export const BudgetLineItemInputSchema = z.object({
  categoryId: z.string().cuid(),
  description: z.string().min(1).max(500),
  budgetedAmount: z.coerce.number().min(0),
  actualAmount: z.coerce.number().min(0).optional().nullable(),
  vendor: z.string().max(200).optional().nullable(),
  expenseDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export type BudgetLineItemInput = z.infer<typeof BudgetLineItemInputSchema>

/** Input schema for creating or updating a revenue entry. */
export const BudgetRevenueInputSchema = z.object({
  source: z.enum(BUDGET_REVENUE_SOURCES),
  description: z.string().min(1).max(500),
  amount: z.coerce.number().min(0),
  receivedDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export type BudgetRevenueInput = z.infer<typeof BudgetRevenueInputSchema>

// ─── Client-Safe Data Types ───────────────────────────────────────────────────

/** A budget category with its associated line items summary. */
export interface CategorySummary {
  id: string
  name: string
  sortOrder: number
  isPreset: boolean
  lineItemCount: number
  totalBudgeted: number
  totalActual: number
}

/** Full budget vs actual report data for an event project. */
export interface BudgetReportData {
  categories: CategorySummary[]
  totalBudgeted: number
  totalActual: number
  totalRevenue: number
  netPosition: number
  registrationCount: number
  perParticipantCost: number
}

/** A single budget category row (flat, for list endpoints). */
export interface BudgetCategoryRow {
  id: string
  eventProjectId: string
  name: string
  sortOrder: number
  isPreset: boolean
  createdAt: string
  updatedAt: string
}

/** A single budget line item row (flat, for list endpoints). */
export interface BudgetLineItemRow {
  id: string
  eventProjectId: string
  categoryId: string
  categoryName: string
  description: string
  budgetedAmount: number
  actualAmount: number | null
  vendor: string | null
  receiptUrl: string | null
  expenseDate: string | null
  notes: string | null
  createdById: string
  createdAt: string
  updatedAt: string
}

/** A single revenue entry row (flat, for list endpoints). */
export interface BudgetRevenueRow {
  id: string
  eventProjectId: string
  source: BudgetRevenueSource
  description: string
  amount: number
  receivedDate: string | null
  notes: string | null
  isAutoPopulated: boolean
  createdById: string
  createdAt: string
  updatedAt: string
}
