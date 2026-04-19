import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const BulkActionSchema = z.object({
  action: z.enum(['assign', 'update-priority', 'update-status']),
  ticketIds: z.array(z.string()).min(1).max(50),
  assignedToId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.string().optional(),
})

export const POST = withAuth<z.infer<typeof BulkActionSchema>>(async ({ body, ctx }) => {
  const { action, ticketIds, assignedToId, priority, status } = body
  let updatedCount = 0

  if (action === 'assign') {
    if (!assignedToId) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'assignedToId required'), { status: 400 })
    }
    const result = await prisma.maintenanceTicket.updateMany({
      where: { id: { in: ticketIds } },
      data: { assignedToId, firstResponseAt: new Date() },
    })
    updatedCount = result.count
  }

  if (action === 'update-priority') {
    if (!priority) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'priority required'), { status: 400 })
    }
    const result = await prisma.maintenanceTicket.updateMany({
      where: { id: { in: ticketIds } },
      data: { priority },
    })
    updatedCount = result.count
  }

  if (action === 'update-status') {
    if (!status) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'status required'), { status: 400 })
    }
    const result = await prisma.maintenanceTicket.updateMany({
      where: { id: { in: ticketIds } },
      data: { status: status as 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'ON_HOLD' | 'SCHEDULED' | 'QA' | 'DONE' | 'CANCELLED' },
    })
    updatedCount = result.count
  }

  return NextResponse.json(ok({ updatedCount }))
}, { permission: PERMISSIONS.MAINTENANCE_ASSIGN, schema: BulkActionSchema })
