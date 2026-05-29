import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { checkinItem, CheckinSchema } from '@/lib/services/inventoryService'
import { inventoryErrorResponse } from '../../error-response'

export const POST = withAuth(async ({ req, orgId, ctx }) => {
  const body = await req.json()
  const parsed = CheckinSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
      { status: 400 }
    )
  }

  try {
    const item = await checkinItem(orgId, parsed.data, ctx.userId)
    return NextResponse.json(ok(item))
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}, { permission: PERMISSIONS.INVENTORY_CHECKIN })
