/**
 * GET    /api/events/projects/[id]/budget/revenue         — List revenue entries
 * POST   /api/events/projects/[id]/budget/revenue         — Create revenue entry
 * PATCH  /api/events/projects/[id]/budget/revenue         — Update revenue entry
 * DELETE /api/events/projects/[id]/budget/revenue         — Delete revenue entry
 *
 * GET ?sync=true triggers syncRegistrationRevenue before returning entries.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
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

type Params = { params: Promise<{ id: string }> }

// ─── GET: list revenue entries (optionally sync Stripe first) ─────────────────

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_READ)

    const syncParam = req.nextUrl.searchParams.get('sync')

    return await runWithOrgContext(orgId, async () => {
      if (syncParam === 'true') {
        await syncRegistrationRevenue(eventProjectId)
      }
      const revenue = await getRevenue(eventProjectId)
      return NextResponse.json(ok(revenue))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── POST: create a revenue entry ────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_MANAGE)

    const body = await req.json()
    const parsed = BudgetRevenueInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const revenue = await createRevenue(eventProjectId, parsed.data, ctx.userId)
      return NextResponse.json(ok(revenue), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── PATCH: update a revenue entry ───────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_MANAGE)

    const body = await req.json()
    const parsed = UpdateRevenueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'revenueId is required', parsed.error.issues),
        { status: 400 },
      )
    }

    const { revenueId, ...updateFields } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      const updated = await updateRevenue(revenueId, updateFields)
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── DELETE: remove a revenue entry ──────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_MANAGE)

    const body = await req.json()
    const parsed = DeleteRevenueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'revenueId is required', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      await deleteRevenue(parsed.data.revenueId)
      return NextResponse.json(ok(null))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
