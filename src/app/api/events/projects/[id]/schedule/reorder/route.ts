import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma } from '@/lib/db'

const ReorderSchema = z.object({
  /** Ordered list of block IDs — index becomes the new sortOrder */
  blockIds: z.array(z.string().min(1)).min(1),
})

/**
 * PATCH /api/events/projects/[id]/schedule/reorder
 *
 * Accepts an ordered array of block IDs and updates their sortOrder accordingly.
 * Uses a transaction to ensure atomic reordering.
 */
export const PATCH = withAuth(async ({ body }) => {
  // Use rawPrisma for the batch transaction
  const updates = body.blockIds.map((blockId, index) =>
    rawPrisma.eventScheduleBlock.update({
      where: { id: blockId },
      data: { sortOrder: index },
    })
  )

  await rawPrisma.$transaction(updates)

  return NextResponse.json(ok({ reordered: body.blockIds.length }))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: ReorderSchema })
