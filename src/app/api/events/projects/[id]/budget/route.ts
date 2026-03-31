/**
 * GET  /api/events/projects/[id]/budget  — List categories + line items
 * POST /api/events/projects/[id]/budget  — Create a new budget line item
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { BudgetLineItemInputSchema } from '@/lib/types/budget'
import {
  initializeCategories,
  getCategories,
  getLineItems,
  createLineItem,
} from '@/lib/services/budgetService'

// ─── GET: list categories + line items ───────────────────────────────────────

export const GET = withAuth(async ({ params, ctx }) => {
  const { id: eventProjectId } = params

  // Idempotent: seeds preset categories on first access
  await initializeCategories(eventProjectId)
  const [categories, lineItems] = await Promise.all([
    getCategories(eventProjectId),
    getLineItems(eventProjectId),
  ])
  return NextResponse.json(ok({ categories, lineItems }))
}, { permission: PERMISSIONS.EVENTS_BUDGET_READ })

// ─── POST: create a budget line item ─────────────────────────────────────────

export const POST = withAuth(async ({ params, ctx, body }) => {
  const { id: eventProjectId } = params

  const lineItem = await createLineItem(eventProjectId, body, ctx.userId)
  return NextResponse.json(ok(lineItem), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_BUDGET_MANAGE, schema: BudgetLineItemInputSchema })
