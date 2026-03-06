/**
 * PATCH /api/maintenance/tickets/[id]/checklist — toggle a PM checklist item
 *
 * Body: { index: number, done: boolean }
 *
 * Updates pmChecklistDone[index] to the provided done value.
 * Validates index is within bounds of pmChecklistItems.
 * Permission: MAINTENANCE_CLAIM (technician or head can toggle).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { canAny } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, rawPrisma } from '@/lib/db'

const ChecklistToggleSchema = z.object({
  index: z.number().int().min(0),
  done: z.boolean(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    // Permission: technician (claim) or head (assign)
    const hasPermission = await canAny(ctx.userId, [
      PERMISSIONS.MAINTENANCE_CLAIM,
      PERMISSIONS.MAINTENANCE_ASSIGN,
    ])
    if (!hasPermission) {
      return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
    }

    const body = await req.json()
    const parsed = ChecklistToggleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'),
        { status: 400 }
      )
    }
    const { index, done } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      const ticket = await prisma.maintenanceTicket.findUnique({
        where: { id },
        select: {
          id: true,
          pmScheduleId: true,
          pmChecklistItems: true,
          pmChecklistDone: true,
        },
      })

      if (!ticket) {
        return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
      }

      const checklistItems = (ticket.pmChecklistItems ?? []) as string[]
      const checklistDone = (ticket.pmChecklistDone ?? []) as boolean[]

      if (index >= checklistItems.length) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', `Index ${index} is out of bounds (${checklistItems.length} items)`),
          { status: 400 }
        )
      }

      // Build updated done array
      const updatedDone = [...checklistDone]
      // Ensure array matches items length
      while (updatedDone.length < checklistItems.length) {
        updatedDone.push(false)
      }
      updatedDone[index] = done

      // Use rawPrisma for the update to bypass org-scoped extension (ticket already confirmed in org)
      const updated = await rawPrisma.maintenanceTicket.update({
        where: { id },
        data: { pmChecklistDone: updatedDone },
        select: {
          id: true,
          pmChecklistItems: true,
          pmChecklistDone: true,
        },
      })

      return NextResponse.json(
        ok({
          pmChecklistItems: updated.pmChecklistItems,
          pmChecklistDone: updated.pmChecklistDone,
        })
      )
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
    }
    console.error('[PATCH /api/maintenance/tickets/[id]/checklist]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
