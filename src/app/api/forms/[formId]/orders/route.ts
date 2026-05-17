/**
 * GET /api/forms/[formId]/orders — List orders + summary stats for a ticketed form
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

type RouteParams = { params: Promise<{ formId: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { formId } = await params

    return await runWithOrgContext(orgId, async () => {
      // Get orders with line items
      const orders = await prisma.formOrder.findMany({
        where: { formId },
        orderBy: { createdAt: 'desc' },
        include: {
          lineItems: {
            include: { ticketType: { select: { name: true } } },
          },
          _count: { select: { tickets: true } },
        },
      })

      // Get ticket types for summary
      const ticketTypes = await prisma.ticketType.findMany({
        where: { formId },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          price: true,
          totalInventory: true,
          soldCount: true,
        },
      })

      // Compute summary stats
      const confirmedOrders = orders.filter((o) => o.status === 'CONFIRMED')
      const totalRevenue = confirmedOrders.reduce((sum, o) => sum + o.total, 0)
      const totalTicketsSold = ticketTypes.reduce((sum, tt) => sum + tt.soldCount, 0)
      const totalCapacity = ticketTypes.reduce((sum, tt) => sum + (tt.totalInventory ?? 0), 0)
      const hasUnlimited = ticketTypes.some((tt) => tt.totalInventory == null)

      // Check-in count
      const checkedIn = await prisma.eventTicket.count({
        where: {
          order: { formId },
          status: 'USED',
        },
      })

      return NextResponse.json(ok({
        summary: {
          totalRevenue,
          totalOrders: confirmedOrders.length,
          totalTicketsSold,
          totalCapacity: hasUnlimited ? null : totalCapacity,
          checkedIn,
        },
        ticketTypes: ticketTypes.map((tt) => ({
          id: tt.id,
          name: tt.name,
          price: tt.price,
          sold: tt.soldCount,
          total: tt.totalInventory,
          revenue: tt.soldCount * tt.price,
        })),
        orders: orders.map((o) => ({
          id: o.id,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          status: o.status,
          paymentStatus: o.paymentStatus,
          total: o.total,
          discountCode: o.discountCode,
          discountAmount: o.discountAmount,
          createdAt: o.createdAt.toISOString(),
          paidAt: o.paidAt?.toISOString() ?? null,
          ticketCount: o._count.tickets,
          lineItems: o.lineItems.map((li) => ({
            ticketTypeName: li.ticketType.name,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            subtotal: li.subtotal,
          })),
        })),
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
