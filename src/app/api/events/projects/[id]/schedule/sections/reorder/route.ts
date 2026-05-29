import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
// eslint-disable-next-line no-restricted-imports -- Schedule section reorder uses a batch transaction after verifying all section IDs belong to this event and organization.
import { rawPrisma } from '@/lib/db'

const ReorderSectionsSchema = z.object({
  /** Ordered list of section IDs — index becomes the new sortOrder */
  sectionIds: z.array(z.string().min(1)).min(1),
})

/**
 * PATCH /api/events/projects/[id]/schedule/sections/reorder
 *
 * Accepts an ordered array of section IDs and updates their sortOrder accordingly.
 * Uses a transaction to ensure atomic reordering.
 */
export const PATCH = withAuth(async ({ orgId, params, body }) => {
  const eventProjectId = params.id
  const ownedCount = await rawPrisma.eventScheduleSection.count({
    where: {
      id: { in: body.sectionIds },
      eventProjectId,
      organizationId: orgId,
    },
  })

  if (ownedCount !== body.sectionIds.length) {
    return NextResponse.json(
      fail('NOT_FOUND', 'One or more schedule sections were not found for this event'),
      { status: 404 }
    )
  }

  const updates = body.sectionIds.map((sectionId, index) =>
    rawPrisma.eventScheduleSection.update({
      where: { id: sectionId },
      data: { sortOrder: index },
    })
  )

  await rawPrisma.$transaction(updates)

  return NextResponse.json(ok({ reordered: body.sectionIds.length }))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: ReorderSectionsSchema })
