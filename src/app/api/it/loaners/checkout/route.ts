/**
 * POST /api/it/loaners/checkout — checkout a loaner device
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { checkout, CheckoutSchema } from '@/lib/services/itLoanerService'

export const POST = withAuth(async ({ req, ctx }) => {
  const body = await req.json()
  const validated = CheckoutSchema.parse(body)

  const result = await checkout(validated, ctx.userId)

  return NextResponse.json(ok(result), { status: 201 })
}, { permission: PERMISSIONS.IT_LOANER_CHECKOUT })
