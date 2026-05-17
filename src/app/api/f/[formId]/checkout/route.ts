/**
 * POST /api/f/[formId]/checkout — Create an order + payment intent for a ticketed form
 *
 * Public endpoint (no auth). Validates inventory, creates FormOrder + LineItems,
 * and returns a Stripe clientSecret for payment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
// eslint-disable-next-line no-restricted-imports -- public checkout endpoint, no org context from JWT
import { rawPrisma } from '@/lib/db'
import { z } from 'zod'
import Stripe from 'stripe'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const checkoutSchema = z.object({
  lineItems: z.array(z.object({
    ticketTypeId: z.string(),
    quantity: z.number().int().min(1),
  })).min(1),
  buyerName: z.string().min(1).max(200),
  buyerEmail: z.string().email(),
  buyerPhone: z.string().max(30).optional(),
  discountCode: z.string().max(50).optional(),
  formData: z.record(z.string()).optional(), // custom field responses
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params

  try {
    const body = await req.json()
    const parsed = checkoutSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid checkout data', parsed.error.issues),
        { status: 400 }
      )
    }

    const { lineItems, buyerName, buyerEmail, buyerPhone, discountCode, formData } = parsed.data

    // Fetch form + ticket types
    const form = await rawPrisma.formDefinition.findUnique({
      where: { id: formId },
      select: {
        id: true,
        organizationId: true,
        discountCodes: true,
        maxCapacity: true,
        ticketTypes: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            maxPerOrder: true,
            totalInventory: true,
            soldCount: true,
          },
        },
      },
    })

    if (!form) {
      return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
    }

    // Validate line items against ticket types
    const ticketTypeMap = new Map(form.ticketTypes.map((tt) => [tt.id, tt]))
    let subtotal = 0
    let totalTicketsRequested = 0
    const validatedItems: Array<{ ticketTypeId: string; quantity: number; unitPrice: number; subtotal: number }> = []

    for (const item of lineItems) {
      const tt = ticketTypeMap.get(item.ticketTypeId)
      if (!tt) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', `Ticket type not found: ${item.ticketTypeId}`),
          { status: 400 }
        )
      }
      if (tt.maxPerOrder && item.quantity > tt.maxPerOrder) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', `Maximum ${tt.maxPerOrder} tickets per order for "${tt.name}"`),
          { status: 400 }
        )
      }
      // Check per-type limit (optional — only if the admin set one for this tier)
      if (tt.totalInventory != null) {
        const remaining = tt.totalInventory - tt.soldCount
        if (item.quantity > remaining) {
          return NextResponse.json(
            fail('INVENTORY_ERROR', `Only ${remaining} "${tt.name}" tickets remaining`),
            { status: 409 }
          )
        }
      }

      totalTicketsRequested += item.quantity
      const itemSubtotal = tt.price * item.quantity
      subtotal += itemSubtotal
      validatedItems.push({
        ticketTypeId: tt.id,
        quantity: item.quantity,
        unitPrice: tt.price,
        subtotal: itemSubtotal,
      })
    }

    // Check shared capacity (form-level limit across all ticket types)
    if (form.maxCapacity != null) {
      const totalSold = form.ticketTypes.reduce((sum, tt) => sum + tt.soldCount, 0)
      const remaining = form.maxCapacity - totalSold
      if (totalTicketsRequested > remaining) {
        return NextResponse.json(
          fail('INVENTORY_ERROR', remaining <= 0
            ? 'Sorry, this event is sold out.'
            : `Only ${remaining} tickets remaining.`),
          { status: 409 }
        )
      }
    }

    // Apply discount code
    let discountAmount = 0
    if (discountCode && form.discountCodes) {
      const codes = form.discountCodes as Array<{
        code: string
        percentOff: number | null
        amountOff: number | null
        maxUses: number | null
        usedCount: number
      }>
      const matched = codes.find((c) => c.code.toUpperCase() === discountCode.toUpperCase())
      if (!matched) {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid promo code'), { status: 400 })
      }
      if (matched.maxUses && matched.usedCount >= matched.maxUses) {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Promo code has expired'), { status: 400 })
      }
      if (matched.percentOff) {
        discountAmount = Math.round(subtotal * matched.percentOff / 100)
      } else if (matched.amountOff) {
        discountAmount = Math.min(matched.amountOff, subtotal)
      }
    }

    const total = subtotal - discountAmount

    // Create the order + line items in a transaction
    const order = await rawPrisma.$transaction(async (tx) => {
      // Re-check shared capacity atomically
      if (form.maxCapacity != null) {
        const freshForm = await tx.formDefinition.findUnique({
          where: { id: formId },
          select: { maxCapacity: true, ticketTypes: { select: { soldCount: true } } },
        })
        if (freshForm?.maxCapacity != null) {
          const currentTotalSold = freshForm.ticketTypes.reduce((s, t) => s + t.soldCount, 0)
          if (currentTotalSold + totalTicketsRequested > freshForm.maxCapacity) {
            throw new Error('SOLD_OUT:event')
          }
        }
      }

      // Re-check per-type limits atomically
      for (const item of validatedItems) {
        const tt = await tx.ticketType.findUnique({ where: { id: item.ticketTypeId } })
        if (!tt) throw new Error(`Ticket type gone: ${item.ticketTypeId}`)
        if (tt.totalInventory != null && (tt.soldCount + item.quantity) > tt.totalInventory) {
          throw new Error(`SOLD_OUT:${tt.name}`)
        }
      }

      // Create order
      const newOrder = await tx.formOrder.create({
        data: {
          organizationId: form.organizationId,
          formId,
          buyerName,
          buyerEmail,
          buyerPhone: buyerPhone ?? null,
          subtotal,
          discountAmount,
          discountCode: discountCode ?? null,
          total,
          status: total > 0 ? 'PENDING' : 'CONFIRMED',
          paymentStatus: total > 0 ? 'UNPAID' : 'PAID',
          paidAt: total === 0 ? new Date() : null,
          lineItems: {
            create: validatedItems.map((item) => ({
              ticketTypeId: item.ticketTypeId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
      })

      // Increment sold counts
      for (const item of validatedItems) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { soldCount: { increment: item.quantity } },
        })
      }

      // Increment discount code usage
      if (discountCode && form.discountCodes) {
        const codes = form.discountCodes as Array<{
          code: string; percentOff: number | null; amountOff: number | null
          maxUses: number | null; usedCount: number
        }>
        const updatedCodes = codes.map((c) =>
          c.code.toUpperCase() === discountCode.toUpperCase()
            ? { ...c, usedCount: c.usedCount + 1 }
            : c
        )
        await tx.formDefinition.update({
          where: { id: formId },
          data: { discountCodes: updatedCodes },
        })
      }

      // Create FormSubmission if there's form data
      if (formData && Object.keys(formData).length > 0) {
        const submission = await tx.formSubmission.create({
          data: {
            organizationId: form.organizationId,
            formId,
            submitterName: buyerName,
            submitterEmail: buyerEmail,
            data: formData,
            status: 'SUBMITTED',
          },
        })
        await tx.formOrder.update({
          where: { id: newOrder.id },
          data: { submissionId: submission.id },
        })
      }

      return newOrder
    })

    // If total is $0, no payment needed — fulfill immediately
    if (total === 0) {
      const { fulfillOrder } = await import('@/lib/services/eventTicketService')
      await fulfillOrder(order.id)
      return NextResponse.json(ok({
        orderId: order.id,
        total: 0,
        status: 'CONFIRMED',
        clientSecret: null,
      }))
    }

    // Create Stripe PaymentIntent
    if (!stripe) {
      return NextResponse.json(fail('INTERNAL_ERROR', 'Payment processing not configured'), { status: 500 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'usd',
      metadata: {
        formOrderId: order.id,
        formId,
        organizationId: form.organizationId,
        buyerEmail,
      },
    })

    // Store the payment intent ID on the order
    await rawPrisma.formOrder.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    })

    return NextResponse.json(ok({
      orderId: order.id,
      total,
      subtotal,
      discountAmount,
      status: 'PENDING',
      clientSecret: paymentIntent.client_secret,
    }))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('SOLD_OUT:')) {
        const name = error.message.replace('SOLD_OUT:', '')
        const msg = name === 'event'
          ? 'Sorry, this event just sold out. Please try again or adjust your order.'
          : `Sorry, "${name}" tickets just sold out. Please adjust your order.`
        return NextResponse.json(fail('INVENTORY_ERROR', msg), { status: 409 })
      }
    }
    console.error('[checkout]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
