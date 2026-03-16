/**
 * GET  /api/events/projects/[id]/budget  — List categories + line items
 * POST /api/events/projects/[id]/budget  — Create a new budget line item
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import { BudgetLineItemInputSchema } from '@/lib/types/budget'
import {
  initializeCategories,
  getCategories,
  getLineItems,
  createLineItem,
} from '@/lib/services/budgetService'

type Params = { params: Promise<{ id: string }> }

// ─── GET: list categories + line items ───────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_READ)

    return await runWithOrgContext(orgId, async () => {
      // Idempotent: seeds preset categories on first access
      await initializeCategories(eventProjectId)
      const [categories, lineItems] = await Promise.all([
        getCategories(eventProjectId),
        getLineItems(eventProjectId),
      ])
      return NextResponse.json(ok({ categories, lineItems }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── POST: create a budget line item ─────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_MANAGE)

    const body = await req.json()
    const parsed = BudgetLineItemInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const lineItem = await createLineItem(eventProjectId, parsed.data, ctx.userId)
      return NextResponse.json(ok(lineItem), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Category not found')) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
