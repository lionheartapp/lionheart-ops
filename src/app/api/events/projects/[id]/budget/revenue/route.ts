/**
 * GET    /api/events/projects/[id]/budget/revenue         — List revenue entries
 * POST   /api/events/projects/[id]/budget/revenue         — Create revenue entry
 * PATCH  /api/events/projects/[id]/budget/revenue         — Update revenue entry
 * DELETE /api/events/projects/[id]/budget/revenue         — Delete revenue entry
 *
 * GET ?sync=true triggers syncRegistrationRevenue before returning entries.
 */

import { z } from 'zod'
import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { BudgetRevenueInputSchema } from '@/lib/types/budget'
import {
  getRevenue,
  createRevenue,
  updateRevenue,
  deleteRevenue,
  syncRegistrationRevenue,
} from '@/lib/services/budgetService'

const UpdateRevenueSchema = BudgetRevenueInputSchema.partial().extend({
  revenueId: z.string().cuid(),
})

const DeleteRevenueSchema = z.object({
  revenueId: z.string().cuid(),
})

// ─── GET: list revenue entries (optionally sync Stripe first) ─────────────────

export const GET = withAuth(async ({ params, searchParams }) => {
  const { id: eventProjectId } = params
  const syncParam = searchParams.get('sync')

  if (syncParam === 'true') {
    await syncRegistrationRevenue(eventProjectId)
  }
  const revenue = await getRevenue(eventProjectId)
  return NextResponse.json(ok(revenue))
}, { permission: PERMISSIONS.EVENTS_BUDGET_READ })

// ─── POST: create a revenue entry ────────────────────────────────────────────

export const POST = withAuth(async ({ params, ctx, body }) => {
  const { id: eventProjectId } = params

  const revenue = await createRevenue(eventProjectId, body, ctx.userId)
  return NextResponse.json(ok(revenue), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_BUDGET_MANAGE, schema: BudgetRevenueInputSchema })

// ─── PATCH: update a revenue entry ───────────────────────────────────────────

export const PATCH = withAuth(async ({ body }) => {
  const { revenueId, ...updateFields } = body

  const updated = await updateRevenue(revenueId, updateFields)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.EVENTS_BUDGET_MANAGE, schema: UpdateRevenueSchema })

// ─── DELETE: remove a revenue entry ──────────────────────────────────────────

export const DELETE = withAuth(async ({ body }) => {
  await deleteRevenue(body.revenueId)
  return NextResponse.json(ok(null))
}, { permission: PERMISSIONS.EVENTS_BUDGET_MANAGE, schema: DeleteRevenueSchema })
