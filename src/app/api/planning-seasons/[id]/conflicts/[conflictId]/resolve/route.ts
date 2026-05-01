import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

/** POST — mark a conflict as resolved */
export const POST = withAuth(async ({ params }) => {
  const conflict = await prisma.planningConflict.update({
    where: { id: params.conflictId },
    data: { isResolved: true },
  })
  return NextResponse.json(ok(conflict))
}, { permission: PERMISSIONS.PLANNING_VIEW })
