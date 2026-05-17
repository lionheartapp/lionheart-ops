/**
 * GET  /api/forms/[formId]/tickets — Get ticket types + config for a form
 * POST /api/forms/[formId]/tickets — Create a new ticket type
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { z } from 'zod'

type RouteParams = { params: Promise<{ formId: string }> }

const createTicketTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  price: z.number().int().min(0),
  maxPerOrder: z.number().int().min(1).nullable().optional(),
  totalInventory: z.number().int().min(1).nullable().optional(),
  salesStartAt: z.string().nullable().optional(),
  salesEndAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  depositPercent: z.number().int().min(0).max(100).nullable().optional(),
})

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { formId } = await params

    return await runWithOrgContext(orgId, async () => {
      const form = await prisma.formDefinition.findFirst({
        where: { id: formId },
        select: {
          maxCapacity: true,
          waitlistEnabled: true,
          discountCodes: true,
          ticketTypes: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      })

      if (!form) {
        return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
      }

      return NextResponse.json(ok({
        ticketTypes: form.ticketTypes,
        maxCapacity: form.maxCapacity,
        waitlistEnabled: form.waitlistEnabled,
        discountCodes: (form.discountCodes as unknown[]) ?? [],
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { formId } = await params
    const body = await req.json()
    const parsed = createTicketTypeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid ticket type data', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      // Verify form exists
      const form = await prisma.formDefinition.findFirst({
        where: { id: formId },
        select: { id: true, _count: { select: { ticketTypes: true } } },
      })

      if (!form) {
        return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
      }

      const { salesStartAt, salesEndAt, ...rest } = parsed.data

      const ticketType = await prisma.ticketType.create({
        data: {
          formId,
          ...rest,
          description: rest.description ?? null,
          maxPerOrder: rest.maxPerOrder ?? null,
          totalInventory: rest.totalInventory ?? null,
          depositPercent: rest.depositPercent ?? null,
          isActive: rest.isActive ?? true,
          salesStartAt: salesStartAt ? new Date(salesStartAt) : null,
          salesEndAt: salesEndAt ? new Date(salesEndAt) : null,
          sortOrder: form._count.ticketTypes, // append at end
        },
      })

      return NextResponse.json(ok(ticketType), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
