/**
 * PATCH /api/maintenance/tickets/[id]/checklist — toggle a PM checklist item
 *
 * Body: { index: number, done: boolean }
 *
 * Updates pmChecklistDone[index] to the provided done value.
 * Validates index is within bounds of pmChecklistItems.
 * Permission: MAINTENANCE_CLAIM or MAINTENANCE_ASSIGN (technician or head can toggle).
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const ChecklistToggleSchema = z.object({
  index: z.number().int().min(0),
  done: z.boolean(),
})

export const PATCH = withAuth(async ({ req, params }) => {
  const body = await req.json()
  const parsed = ChecklistToggleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body'),
      { status: 400 }
    )
  }
  const { index, done } = parsed.data

  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: params.id },
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

  const updated = await prisma.maintenanceTicket.update({
    where: { id: params.id },
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
}, {
  permissionAny: [PERMISSIONS.MAINTENANCE_CLAIM, PERMISSIONS.MAINTENANCE_ASSIGN],
})
