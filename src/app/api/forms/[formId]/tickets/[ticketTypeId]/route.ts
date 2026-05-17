/**
 * PATCH  /api/forms/[formId]/tickets/[ticketTypeId] — Update a ticket type
 * DELETE /api/forms/[formId]/tickets/[ticketTypeId] — Delete a ticket type
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { z } from 'zod'

type RouteParams = { params: Promise<{ formId: string; ticketTypeId: string }> }

const updateTicketTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  price: z.number().int().min(0).optional(),
  maxPerOrder: z.number().int().min(1).nullable().optional(),
  totalInventory: z.number().int().min(1).nullable().optional(),
  salesStartAt: z.string().nullable().optional(),
  salesEndAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  depositPercent: z.number().int().min(0).max(100).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { formId, ticketTypeId } = await params
    const body = await req.json()
    const parsed = updateTicketTypeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid ticket type data', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      // Verify ticket type belongs to this form
      const existing = await prisma.ticketType.findFirst({
        where: { id: ticketTypeId, formId },
      })

      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket type not found'), { status: 404 })
      }

      const { salesStartAt, salesEndAt, ...rest } = parsed.data

      const updated = await prisma.ticketType.update({
        where: { id: ticketTypeId },
        data: {
          ...rest,
          ...(salesStartAt !== undefined && { salesStartAt: salesStartAt ? new Date(salesStartAt) : null }),
          ...(salesEndAt !== undefined && { salesEndAt: salesEndAt ? new Date(salesEndAt) : null }),
        },
      })

      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { formId, ticketTypeId } = await params

    return await runWithOrgContext(orgId, async () => {
      // Verify ticket type belongs to this form
      const existing = await prisma.ticketType.findFirst({
        where: { id: ticketTypeId, formId },
        select: { id: true, soldCount: true },
      })

      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket type not found'), { status: 404 })
      }

      await prisma.ticketType.delete({ where: { id: ticketTypeId } })

      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
