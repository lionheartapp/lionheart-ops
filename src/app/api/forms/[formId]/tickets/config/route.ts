/**
 * PATCH /api/forms/[formId]/tickets/config — Update ticketing settings (capacity, waitlist, promo codes)
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

const promoCodeSchema = z.object({
  code: z.string().min(1).max(50),
  percentOff: z.number().min(0).max(100).nullable().optional(),
  amountOff: z.number().int().min(0).nullable().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  usedCount: z.number().int().min(0).optional().default(0),
})

const updateConfigSchema = z.object({
  maxCapacity: z.number().int().min(1).nullable().optional(),
  waitlistEnabled: z.boolean().optional(),
  discountCodes: z.array(promoCodeSchema).optional(),
})

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { formId } = await params
    const body = await req.json()
    const parsed = updateConfigSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid config data', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const form = await prisma.formDefinition.findFirst({
        where: { id: formId },
        select: { id: true },
      })

      if (!form) {
        return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
      }

      const updateData: Record<string, unknown> = {}

      if (parsed.data.maxCapacity !== undefined) {
        updateData.maxCapacity = parsed.data.maxCapacity
      }
      if (parsed.data.waitlistEnabled !== undefined) {
        updateData.waitlistEnabled = parsed.data.waitlistEnabled
      }
      if (parsed.data.discountCodes !== undefined) {
        updateData.discountCodes = parsed.data.discountCodes
      }

      const updated = await prisma.formDefinition.update({
        where: { id: formId },
        data: updateData,
        select: { maxCapacity: true, waitlistEnabled: true },
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
