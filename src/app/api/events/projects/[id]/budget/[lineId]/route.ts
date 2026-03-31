/**
 * PATCH  /api/events/projects/[id]/budget/[lineId]  — Update a budget line item
 * DELETE /api/events/projects/[id]/budget/[lineId]  — Delete a budget line item
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { BudgetLineItemInputSchema } from '@/lib/types/budget'
import { updateLineItem, deleteLineItem } from '@/lib/services/budgetService'

// ─── PATCH: update a line item ────────────────────────────────────────────────

export const PATCH = withAuth(async ({ params, body }) => {
  const { lineId } = params

  const updated = await updateLineItem(lineId, body)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.EVENTS_BUDGET_MANAGE, schema: BudgetLineItemInputSchema.partial() })

// ─── DELETE: remove a line item ───────────────────────────────────────────────

export const DELETE = withAuth(async ({ params }) => {
  const { lineId } = params

  await deleteLineItem(lineId)
  return NextResponse.json(ok(null))
}, { permission: PERMISSIONS.EVENTS_BUDGET_MANAGE })
