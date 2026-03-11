import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { checkinItem, CheckinSchema } from '@/lib/services/inventoryService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const log = logger.child({ route: '/api/inventory/[id]/checkin', method: 'POST' })
  try {
    const { id: _id } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INVENTORY_CHECKIN)

    const body = await req.json()
    const parsed = CheckinSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const item = await checkinItem(orgId, parsed.data, ctx.userId)
      return NextResponse.json(ok(item))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && (error as any).code === 'ALREADY_CHECKED_IN') {
      return NextResponse.json(fail('ALREADY_CHECKED_IN', 'This item has already been checked in'), { status: 409 })
    }
    if (error instanceof Error && (error as any).code === 'NOT_FOUND') {
      return NextResponse.json(fail('NOT_FOUND', 'Checkout transaction not found'), { status: 404 })
    }
    log.error({ err: error }, 'Failed to checkin inventory item')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to checkin inventory item'), { status: 500 })
  }
}
