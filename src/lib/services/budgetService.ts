/**
 * Budget Service — Phase 22
 *
 * CRUD for budget categories, line items, and revenue entries.
 * Provides report aggregation (budget vs actual + per-participant cost).
 *
 * All functions use the org-scoped Prisma client (cast as OrgPrismaClient for type safety)
 * and must be called inside a runWithOrgContext block from route handlers.
 */

import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  BUDGET_CATEGORY_PRESETS,
  type BudgetLineItemInput,
  type BudgetRevenueInput,
  type BudgetReportData,
  type CategorySummary,
  type BudgetCategoryRow,
  type BudgetLineItemRow,
  type BudgetRevenueRow,
} from '@/lib/types/budget'

const log = logger.child({ service: 'budgetService' })

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Prisma Decimal (or null) to a JS number safe for JSON. */
function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0
  if (typeof val === 'number') return val
  // Prisma Decimal objects have a .toNumber() method
  if (typeof val === 'object' && val !== null && 'toNumber' in val && typeof (val as { toNumber: () => number }).toNumber === 'function') {
    return (val as { toNumber: () => number }).toNumber()
  }
  return Number(val)
}

function shapeCategory(row: Record<string, unknown>): BudgetCategoryRow {
  return {
    id: row.id as string,
    eventProjectId: row.eventProjectId as string,
    name: row.name as string,
    sortOrder: row.sortOrder as number,
    isPreset: row.isPreset as boolean,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  }
}

function shapeLineItem(row: Record<string, unknown>): BudgetLineItemRow {
  const category = row.category as { name?: string } | null
  return {
    id: row.id as string,
    eventProjectId: row.eventProjectId as string,
    categoryId: row.categoryId as string,
    categoryName: category?.name ?? '',
    description: row.description as string,
    budgetedAmount: toNum(row.budgetedAmount),
    actualAmount: row.actualAmount != null ? toNum(row.actualAmount) : null,
    vendor: (row.vendor as string) ?? null,
    receiptUrl: (row.receiptUrl as string) ?? null,
    expenseDate: row.expenseDate ? (row.expenseDate as Date).toISOString() : null,
    notes: (row.notes as string) ?? null,
    createdById: row.createdById as string,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  }
}

function shapeRevenue(row: Record<string, unknown>): BudgetRevenueRow {
  return {
    id: row.id as string,
    eventProjectId: row.eventProjectId as string,
    source: row.source as BudgetRevenueRow['source'],
    description: row.description as string,
    amount: toNum(row.amount),
    receivedDate: row.receivedDate ? (row.receivedDate as Date).toISOString() : null,
    notes: (row.notes as string) ?? null,
    isAutoPopulated: row.isAutoPopulated as boolean,
    createdById: row.createdById as string,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  }
}

// ─── Category Management ──────────────────────────────────────────────────────

/**
 * Idempotently create preset categories for an event project.
 * No-op if categories already exist.
 */
export async function initializeCategories(eventProjectId: string): Promise<void> {
  const existing = await (prisma as unknown as OrgPrismaClient).budgetCategory.findFirst({
    where: { eventProjectId },
    select: { id: true },
  })

  if (existing) return

  const data = BUDGET_CATEGORY_PRESETS.map((name, index) => ({
    eventProjectId,
    name,
    sortOrder: index,
    isPreset: true,
  }))

  await (prisma as unknown as OrgPrismaClient).budgetCategory.createMany({ data })
  log.info({ eventProjectId }, 'Budget categories initialized with presets')
}

/**
 * Return all categories for an event project, sorted by sortOrder.
 */
export async function getCategories(eventProjectId: string): Promise<BudgetCategoryRow[]> {
  const rows = await (prisma as unknown as OrgPrismaClient).budgetCategory.findMany({
    where: { eventProjectId },
    orderBy: { sortOrder: 'asc' },
  })
  return rows.map(shapeCategory)
}

/**
 * Create a custom (non-preset) budget category.
 */
export async function createCategory(
  eventProjectId: string,
  name: string,
): Promise<BudgetCategoryRow> {
  // Determine next sortOrder
  const maxRow = await (prisma as unknown as OrgPrismaClient).budgetCategory.findFirst({
    where: { eventProjectId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const nextSort = (maxRow?.sortOrder ?? -1) + 1

  const row = await (prisma as unknown as OrgPrismaClient).budgetCategory.create({
    data: {
      eventProjectId,
      name,
      sortOrder: nextSort,
      isPreset: false,
    },
  })
  return shapeCategory(row)
}

/**
 * Update a budget category's name or sortOrder.
 */
export async function updateCategory(
  categoryId: string,
  data: { name?: string; sortOrder?: number },
): Promise<BudgetCategoryRow> {
  const row = await (prisma as unknown as OrgPrismaClient).budgetCategory.update({
    where: { id: categoryId },
    data,
  })
  return shapeCategory(row)
}

/**
 * Delete a category. Throws if it has associated line items.
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  const lineItemCount = await (prisma as unknown as OrgPrismaClient).budgetLineItem.count({
    where: { categoryId },
  })
  if (lineItemCount > 0) {
    throw new Error(
      `Cannot delete category: it has ${lineItemCount} line item(s). Remove line items first.`,
    )
  }
  await (prisma as unknown as OrgPrismaClient).budgetCategory.delete({ where: { id: categoryId } })
}

// ─── Line Item CRUD ───────────────────────────────────────────────────────────

/**
 * Return line items for an event project, optionally filtered by category.
 * Includes category name for display.
 */
export async function getLineItems(
  eventProjectId: string,
  opts?: { categoryId?: string },
): Promise<BudgetLineItemRow[]> {
  const where: Record<string, unknown> = { eventProjectId }
  if (opts?.categoryId) {
    where.categoryId = opts.categoryId
  }

  const rows = await (prisma as unknown as OrgPrismaClient).budgetLineItem.findMany({
    where,
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(shapeLineItem)
}

/**
 * Create a budget line item.
 * Validates that the categoryId belongs to the same eventProject.
 */
export async function createLineItem(
  eventProjectId: string,
  input: BudgetLineItemInput,
  userId: string,
): Promise<BudgetLineItemRow> {
  // Validate category belongs to this event
  const category = await (prisma as unknown as OrgPrismaClient).budgetCategory.findFirst({
    where: { id: input.categoryId, eventProjectId },
    select: { id: true, name: true },
  })
  if (!category) {
    throw new Error('Category not found or does not belong to this event project')
  }

  const row = await (prisma as unknown as OrgPrismaClient).budgetLineItem.create({
    data: {
      eventProjectId,
      categoryId: input.categoryId,
      description: input.description,
      budgetedAmount: input.budgetedAmount,
      actualAmount: input.actualAmount ?? null,
      vendor: input.vendor ?? null,
      expenseDate: input.expenseDate ? new Date(input.expenseDate) : null,
      notes: input.notes ?? null,
      createdById: userId,
    },
    include: { category: { select: { name: true } } },
  })
  return shapeLineItem(row)
}

/**
 * Update a budget line item's fields.
 */
export async function updateLineItem(
  lineId: string,
  input: Partial<BudgetLineItemInput>,
): Promise<BudgetLineItemRow> {
  const updateData: Record<string, unknown> = {}

  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId
  if (input.description !== undefined) updateData.description = input.description
  if (input.budgetedAmount !== undefined) updateData.budgetedAmount = input.budgetedAmount
  if ('actualAmount' in input) updateData.actualAmount = input.actualAmount ?? null
  if ('vendor' in input) updateData.vendor = input.vendor ?? null
  if ('expenseDate' in input)
    updateData.expenseDate = input.expenseDate ? new Date(input.expenseDate) : null
  if ('notes' in input) updateData.notes = input.notes ?? null

  const row = await (prisma as unknown as OrgPrismaClient).budgetLineItem.update({
    where: { id: lineId },
    data: updateData,
    include: { category: { select: { name: true } } },
  })
  return shapeLineItem(row)
}

/**
 * Hard-delete a budget line item.
 */
export async function deleteLineItem(lineId: string): Promise<void> {
  await (prisma as unknown as OrgPrismaClient).budgetLineItem.delete({ where: { id: lineId } })
}

// ─── Revenue ──────────────────────────────────────────────────────────────────

/**
 * Return all revenue entries for an event project, newest first.
 */
export async function getRevenue(eventProjectId: string): Promise<BudgetRevenueRow[]> {
  const rows = await (prisma as unknown as OrgPrismaClient).budgetRevenue.findMany({
    where: { eventProjectId },
    orderBy: { receivedDate: 'desc' },
  })
  return rows.map(shapeRevenue)
}

/**
 * Create a manual revenue entry.
 */
export async function createRevenue(
  eventProjectId: string,
  input: BudgetRevenueInput,
  userId: string,
): Promise<BudgetRevenueRow> {
  const row = await (prisma as unknown as OrgPrismaClient).budgetRevenue.create({
    data: {
      eventProjectId,
      source: input.source,
      description: input.description,
      amount: input.amount,
      receivedDate: input.receivedDate ? new Date(input.receivedDate) : null,
      notes: input.notes ?? null,
      isAutoPopulated: false,
      createdById: userId,
    },
  })
  return shapeRevenue(row)
}

/**
 * Update a revenue entry.
 */
export async function updateRevenue(
  revenueId: string,
  input: Partial<BudgetRevenueInput>,
): Promise<BudgetRevenueRow> {
  const updateData: Record<string, unknown> = {}

  if (input.source !== undefined) updateData.source = input.source
  if (input.description !== undefined) updateData.description = input.description
  if (input.amount !== undefined) updateData.amount = input.amount
  if ('receivedDate' in input)
    updateData.receivedDate = input.receivedDate ? new Date(input.receivedDate) : null
  if ('notes' in input) updateData.notes = input.notes ?? null

  const row = await (prisma as unknown as OrgPrismaClient).budgetRevenue.update({
    where: { id: revenueId },
    data: updateData,
  })
  return shapeRevenue(row)
}

/**
 * Hard-delete a revenue entry.
 */
export async function deleteRevenue(revenueId: string): Promise<void> {
  await (prisma as unknown as OrgPrismaClient).budgetRevenue.delete({ where: { id: revenueId } })
}

/**
 * Sync Stripe-derived registration revenue into BudgetRevenue.
 * Sums all CONFIRMED + PAID EventRegistration payment totals and upserts
 * a single auto-populated REGISTRATION_FEE revenue row.
 *
 * Uses rawPrisma for registration lookups (cross-context access).
 * Uses prisma (org-scoped) for the upsert inside runWithOrgContext.
 */
export async function syncRegistrationRevenue(eventProjectId: string): Promise<void> {
  try {
    // Sum all succeeded payments for REGISTERED + PAID registrations in this event
    const payments = await rawPrisma.registrationPayment.findMany({
      where: {
        registration: {
          eventProjectId,
          status: 'REGISTERED',
          paymentStatus: 'PAID',
          deletedAt: null,
        },
        status: 'succeeded',
      },
      select: { amount: true },
    })

    const totalCents = payments.reduce((sum, p) => sum + p.amount, 0)

    const totalDollars = totalCents / 100

    // Find existing auto-populated REGISTRATION_FEE row
    const existing = await (prisma as unknown as OrgPrismaClient).budgetRevenue.findFirst({
      where: { eventProjectId, source: 'REGISTRATION_FEE', isAutoPopulated: true },
      select: { id: true },
    })

    if (existing) {
      await (prisma as unknown as OrgPrismaClient).budgetRevenue.update({
        where: { id: existing.id },
        data: {
          amount: totalDollars,
          description: 'Registration fee revenue (auto-synced)',
          receivedDate: new Date(),
        },
      })
    } else if (totalDollars > 0) {
      // Get org's first admin user for createdById (required FK)
      const orgProject = await rawPrisma.eventProject.findUnique({
        where: { id: eventProjectId },
        select: { organizationId: true, createdById: true },
      })
      if (orgProject) {
        await (prisma as unknown as OrgPrismaClient).budgetRevenue.create({
          data: {
            eventProjectId,
            source: 'REGISTRATION_FEE',
            description: 'Registration fee revenue (auto-synced)',
            amount: totalDollars,
            receivedDate: new Date(),
            isAutoPopulated: true,
            createdById: orgProject.createdById,
          },
        })
      }
    }

    log.info({ eventProjectId, totalDollars }, 'Registration revenue synced')
  } catch (err) {
    log.error({ err, eventProjectId }, 'Failed to sync registration revenue')
    // Non-fatal — report still works with whatever revenue data exists
  }
}

// ─── Reporting ────────────────────────────────────────────────────────────────

/**
 * Generate a budget vs actual report for an event project.
 * Returns per-category summaries and aggregated totals.
 */
export async function getBudgetReport(eventProjectId: string): Promise<BudgetReportData> {
  const [categories, lineItems, revenues, registrationCount] = await Promise.all([
    (prisma as unknown as OrgPrismaClient).budgetCategory.findMany({
      where: { eventProjectId },
      orderBy: { sortOrder: 'asc' },
    }),
    (prisma as unknown as OrgPrismaClient).budgetLineItem.findMany({
      where: { eventProjectId },
    }),
    (prisma as unknown as OrgPrismaClient).budgetRevenue.findMany({
      where: { eventProjectId },
    }),
    rawPrisma.eventRegistration.count({
      where: {
        eventProjectId,
        status: { not: 'CANCELLED' },
        deletedAt: null,
      },
    }),
  ])

  // Build category summaries
  const categorySummaries: CategorySummary[] = categories.map((cat: Record<string, unknown>) => {
    const catItems = lineItems.filter((li: Record<string, unknown>) => li.categoryId === cat.id)
    const totalBudgeted = catItems.reduce((sum: number, li: Record<string, unknown>) => sum + toNum(li.budgetedAmount), 0)
    const totalActual = catItems.reduce((sum: number, li: Record<string, unknown>) => {
      return li.actualAmount != null ? sum + toNum(li.actualAmount) : sum
    }, 0)

    return {
      id: cat.id as string,
      name: cat.name as string,
      sortOrder: cat.sortOrder as number,
      isPreset: cat.isPreset as boolean,
      lineItemCount: catItems.length,
      totalBudgeted,
      totalActual,
    }
  })

  const totalBudgeted = lineItems.reduce(
    (sum: number, li: Record<string, unknown>) => sum + toNum(li.budgetedAmount),
    0,
  )
  const totalActual = lineItems.reduce((sum: number, li: Record<string, unknown>) => {
    return li.actualAmount != null ? sum + toNum(li.actualAmount) : sum
  }, 0)
  const totalRevenue = revenues.reduce(
    (sum: number, rv: Record<string, unknown>) => sum + toNum(rv.amount),
    0,
  )
  const netPosition = totalRevenue - totalActual
  const perParticipantCost = registrationCount > 0 ? totalActual / registrationCount : 0

  return {
    categories: categorySummaries,
    totalBudgeted,
    totalActual,
    totalRevenue,
    netPosition,
    registrationCount,
    perParticipantCost,
  }
}
