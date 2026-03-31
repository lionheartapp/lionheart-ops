import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { UpdateScheduleSectionSchema } from '@/lib/types/event-project'

/**
 * PATCH /api/events/projects/[id]/schedule/sections/[sectionId]
 *
 * Updates a schedule section (title, sortOrder).
 */
export const PATCH = withAuth(async ({ params, body }) => {
  const db = prisma as any

  const section = await db.eventScheduleSection.update({
    where: { id: params.sectionId },
    data: body,
  })
  return NextResponse.json(ok(section))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: UpdateScheduleSectionSchema })

/**
 * DELETE /api/events/projects/[id]/schedule/sections/[sectionId]
 *
 * Deletes a schedule section. Blocks in the section are unassigned (sectionId -> null).
 */
export const DELETE = withAuth(async ({ params }) => {
  const db = prisma as any

  // Unassign all blocks from this section first
  await db.eventScheduleBlock.updateMany({
    where: { sectionId: params.sectionId, eventProjectId: params.id },
    data: { sectionId: null },
  })

  // Delete the section
  await db.eventScheduleSection.delete({
    where: { id: params.sectionId },
  })

  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL })
