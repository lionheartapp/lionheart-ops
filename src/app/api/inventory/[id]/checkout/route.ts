import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { checkoutItem, CheckoutSchema } from '@/lib/services/inventoryService'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INVENTORY_CHECKOUT)

    const body = await req.json()
    const parsed = CheckoutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const item = await checkoutItem(orgId, id, parsed.data, ctx.userId)
      return NextResponse.json(ok(item))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && (error as any).code === 'INSUFFICIENT_STOCK') {
      return NextResponse.json(fail('INSUFFICIENT_STOCK', 'Not enough items in stock'), { status: 409 })
    }
    if (error instanceof Error && (error as any).code === 'NOT_FOUND') {
      return NextResponse.json(fail('NOT_FOUND', 'Inventory item not found'), { status: 404 })
    }
    console.error('Failed to checkout inventory item:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to checkout inventory item'), { status: 500 })
  }
}
