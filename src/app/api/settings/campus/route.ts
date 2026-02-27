import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

/**
 * GET /api/settings/campus
 * Returns buildings, areas, and rooms in a single request, running all three
 * DB queries in parallel after a single auth + permission check.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const includeInactive = searchParams.get('includeInactive') === 'true'
      const db = prisma as any

      const where = {
        organizationId: orgId,
        ...(includeInactive ? {} : { isActive: true }),
      }

      const [buildings, areas, rooms] = await Promise.all([
        db.building.findMany({
          where,
          include: { school: { select: { id: true, name: true, gradeLevel: true } } },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
        db.area.findMany({
          where,
          include: {
            building: { select: { id: true, name: true, code: true } },
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        }),
        db.room.findMany({
          where,
          include: {
            building: { select: { id: true, name: true, code: true } },
            area: { select: { id: true, name: true, areaType: true } },
          },
          orderBy: [{ sortOrder: 'asc' }, { roomNumber: 'asc' }],
        }),
      ])

      return NextResponse.json(ok({ buildings, areas, rooms }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch campus data'), { status: 500 })
  }
}
