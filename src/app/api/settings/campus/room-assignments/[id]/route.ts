import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { withAuth } from '@/lib/api/with-auth'

/**
 * DELETE /api/settings/campus/room-assignments/:id
 *
 * Deactivates a room assignment (soft-delete via isActive flag).
 */
export const DELETE = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const existing = await prisma.userRoomAssignment.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Assignment not found'), { status: 404 })
  }

  const assignment = await prisma.userRoomAssignment.update({
    where: { id: params.id },
    data: { isActive: false, endsAt: new Date() },
  })

  return NextResponse.json(ok(assignment))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
