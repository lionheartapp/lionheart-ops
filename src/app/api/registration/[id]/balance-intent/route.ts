/**
 * Staff-facing balance payment API.
 *
 * POST /api/registration/[id]/balance-intent
 *
 * Creates a Stripe PaymentIntent for the remaining balance after a deposit was paid.
 * Optionally sends a balance-request email to the parent.
 *
 * Requires: events:registration:manage permission
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { runWithOrgContext } from '@/lib/org-context'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { createBalanceIntent } from '@/lib/services/registrationPaymentService'
import { sendBalanceRequestEmail } from '@/lib/services/registrationEmailService'
import { rawPrisma } from '@/lib/db'

// ─── Validation ───────────────────────────────────────────────────────────────

const schema = z.object({
  sendEmail: z.boolean().optional().default(false),
  paymentPageUrl: z.string().url().optional(),
})

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: registrationId } = await params
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_REGISTRATION_MANAGE)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      // Body is optional for this endpoint
      body = {}
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request data', parsed.error.issues),
        { status: 400 },
      )
    }

    const { sendEmail, paymentPageUrl } = parsed.data

    // Resolve orgId from the registration itself (not from x-org-id header)
    // because /api/registration/* paths are public in middleware and x-org-id won't be injected
    const registration = await rawPrisma.eventRegistration.findUnique({
      where: { id: registrationId },
      select: { organizationId: true },
    })

    if (!registration) {
      return NextResponse.json(fail('NOT_FOUND', 'Registration not found'), { status: 404 })
    }

    const orgId = registration.organizationId

    return await runWithOrgContext(orgId, async () => {
      const result = await createBalanceIntent(registrationId)

      if (sendEmail) {
        // Build payment link from provided URL or clientSecret
        const paymentLink = paymentPageUrl ?? `${process.env.NEXT_PUBLIC_PLATFORM_URL || ''}/pay/${registrationId}`

        sendBalanceRequestEmail(registrationId, paymentLink).catch((err) => {
          console.error('[balance-intent] sendBalanceRequestEmail failed:', err)
        })
      }

      return NextResponse.json(ok({
        clientSecret: result.clientSecret,
        amount: result.amount,
        currency: result.currency,
      }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message === 'No balance remaining') {
      return NextResponse.json(fail('NO_BALANCE', 'No balance remaining for this registration'), { status: 400 })
    }
    if (error instanceof Error && error.message === 'Registration not found') {
      return NextResponse.json(fail('NOT_FOUND', 'Registration not found'), { status: 404 })
    }
    if (error instanceof Error && error.message.includes('STRIPE_SECRET_KEY')) {
      console.error('[balance-intent] Stripe not configured')
      return NextResponse.json(fail('PAYMENT_NOT_CONFIGURED', 'Payments are not configured'), { status: 503 })
    }
    console.error('[balance-intent POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
