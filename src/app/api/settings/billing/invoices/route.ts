import { NextResponse } from 'next/server'
import Stripe from 'stripe'
// eslint-disable-next-line no-restricted-imports -- Billing invoice lookup reads subscription/payment records by orgId after withAuth/permission checks.
import { rawPrisma } from '@/lib/db'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'

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

function mapInvoiceStatus(stripeStatus: string | null): string {
  switch (stripeStatus) {
    case 'paid': return 'SUCCEEDED'
    case 'open': return 'PENDING'
    case 'void': return 'REFUNDED'
    case 'uncollectible': return 'FAILED'
    default: return 'PENDING'
  }
}

export const GET = withAuth(async ({ orgId }) => {
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
      logger.error({ error: String(stripeError) }, 'Stripe fetch error')
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
}, { permission: PERMISSIONS.SETTINGS_BILLING })
