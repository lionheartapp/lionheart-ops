import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { checkoutItem, CheckoutSchema } from '@/lib/services/inventoryService'

export const POST = withAuth(async ({ req, orgId, ctx, params }) => {
  const body = await req.json()
  const parsed = CheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
      { status: 400 }
    )
  }

  const item = await checkoutItem(orgId, params.id, parsed.data, ctx.userId)
  return NextResponse.json(ok(item))
}, { permission: PERMISSIONS.INVENTORY_CHECKOUT })
