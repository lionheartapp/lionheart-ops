/**
 * Payment Service
 * 
 * Records and queries payment transactions.
 * Uses rawPrisma — not org-scoped.
 */

import { rawPrisma } from '@/lib/db'
import { PaymentStatus } from '@prisma/client'

/**
 * Record a payment
 */
export async function recordPayment(params: {
  organizationId: string
  subscriptionId?: string
  stripeInvoiceId?: string
  stripePaymentIntentId?: string
  amount: number // cents
  currency?: string
  status: PaymentStatus
  paidAt?: Date
}) {
  return rawPrisma.payment.create({
    data: {
      organizationId: params.organizationId,
      subscriptionId: params.subscriptionId || null,
      stripeInvoiceId: params.stripeInvoiceId || null,
      stripePaymentIntentId: params.stripePaymentIntentId || null,
      amount: params.amount,
      currency: params.currency || 'usd',
      status: params.status,
      paidAt: params.paidAt || (params.status === 'SUCCEEDED' ? new Date() : null),
    },
  })
}

/**
 * List payments with filters
 */
export async function listPayments(params: {
  organizationId?: string
  status?: PaymentStatus
  page?: number
  perPage?: number
}) {
  const { organizationId, status, page = 1, perPage = 50 } = params

  const where: Record<string, unknown> = {}
  if (organizationId) where.organizationId = organizationId
  if (status) where.status = status

  const [payments, total] = await Promise.all([
    rawPrisma.payment.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        subscription: { include: { plan: { select: { name: true, slug: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    rawPrisma.payment.count({ where }),
  ])

  return { payments, total, page, perPage }
}
