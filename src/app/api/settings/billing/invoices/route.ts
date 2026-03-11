import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2024-04-10' as Stripe.LatestApiVersion })
}

interface InvoiceItem {
  id: string
  date: string
  amount: number
  currency: string
  status: string
  pdfUrl: string | null
  description: string | null
}

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/settings/billing/invoices', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_BILLING)

    return await runWithOrgContext(orgId, async () => {
      const stripe = getStripe()

      // Get the org's active subscription to find stripeCustomerId
      const subscription = await rawPrisma.subscription.findFirst({
        where: { organizationId: orgId, status: { not: 'CANCELED' } },
        orderBy: { createdAt: 'desc' },
      })

      const org = await rawPrisma.organization.findUnique({
        where: { id: orgId },
        select: { stripeCustomerId: true },
      })

      const stripeCustomerId = subscription?.stripeCustomerId ?? org?.stripeCustomerId ?? null

      // If Stripe is configured and customer exists, fetch from Stripe
      if (stripe && stripeCustomerId) {
        try {
          const stripeInvoices = await stripe.invoices.list({
            customer: stripeCustomerId,
            limit: 12,
          })

          const invoices: InvoiceItem[] = stripeInvoices.data.map((inv) => ({
            id: inv.id,
            date: new Date(inv.created * 1000).toISOString(),
            amount: inv.amount_paid || inv.amount_due,
            currency: inv.currency,
            status: mapInvoiceStatus(inv.status),
            pdfUrl: inv.invoice_pdf ?? null,
            description: inv.description ?? (inv.lines.data[0]?.description ?? null),
          }))

          return NextResponse.json(ok({ invoices }))
        } catch (stripeError) {
          console.error('[GET /api/settings/billing/invoices] Stripe fetch error:', stripeError)
          // Fall through to local Payment fallback
        }
      }

      // Fallback: fetch from local Payment table
      const payments = await rawPrisma.payment.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      })

      const invoices: InvoiceItem[] = payments.map((p) => ({
        id: p.id,
        date: p.createdAt.toISOString(),
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        pdfUrl: null,
        description: null,
      }))

      return NextResponse.json(ok({ invoices }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && (
      error.message.includes('Missing or invalid authorization') ||
      error.message.includes('Invalid or expired token') ||
      error.message.includes('User not found') ||
      error.message.includes('Missing x-org-id')
    )) {
      return NextResponse.json(fail('UNAUTHORIZED', error.message), { status: 401 })
    }
    log.error({ err: error }, 'Failed to fetch billing invoices')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

function mapInvoiceStatus(stripeStatus: string | null): string {
  switch (stripeStatus) {
    case 'paid': return 'SUCCEEDED'
    case 'open': return 'PENDING'
    case 'void': return 'REFUNDED'
    case 'uncollectible': return 'FAILED'
    default: return 'PENDING'
  }
}
