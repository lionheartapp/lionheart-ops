/**
 * POST /api/it/loaners/checkout — checkout a loaner device
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { checkout, CheckoutSchema } from '@/lib/services/itLoanerService'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_LOANER_CHECKOUT)

    const body = await req.json()
    const validated = CheckoutSchema.parse(body)

    const result = await runWithOrgContext(orgId, () =>
      checkout(validated, ctx.userId)
    )

    return NextResponse.json(ok(result), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message.includes('not a loaner') || error.message.includes('already checked out')) {
        return NextResponse.json(fail('CONFLICT', error.message), { status: 409 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[POST /api/it/loaners/checkout]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
