/**
 * PATCH  /api/events/projects/[id]/budget/[lineId]  — Update a budget line item
 * DELETE /api/events/projects/[id]/budget/[lineId]  — Delete a budget line item
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import { BudgetLineItemInputSchema } from '@/lib/types/budget'
import { updateLineItem, deleteLineItem } from '@/lib/services/budgetService'

type Params = { params: Promise<{ id: string; lineId: string }> }

// ─── PATCH: update a line item ────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { lineId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_MANAGE)

    const body = await req.json()
    const parsed = BudgetLineItemInputSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const updated = await updateLineItem(lineId, parsed.data)
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── DELETE: remove a line item ───────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { lineId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_BUDGET_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      await deleteLineItem(lineId)
      return NextResponse.json(ok(null))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
