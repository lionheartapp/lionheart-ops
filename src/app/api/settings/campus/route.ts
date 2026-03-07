import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getCached, settingsCacheKey } from '@/lib/cache/settings-cache'

/**
 * GET /api/settings/campus
 * Returns buildings, areas, and rooms in a single request, running all three
 * DB queries in parallel after a single auth + permission check.
 * Accepts optional ?campusId= to scope data to a specific campus.
 * If campusId is not provided, defaults to the HQ/first campus.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const includeInactive = searchParams.get('includeInactive') === 'true'
      const campusId = searchParams.get('campusId')
      const db = prisma as any

      // If campusId not specified, find the default (HQ) campus
      let selectedCampusId = campusId
      if (!selectedCampusId) {
        const defaultCampus = await db.campus.findFirst({
          where: { organizationId: orgId, deletedAt: null, isActive: true },
          orderBy: [{ campusType: 'asc' }, { sortOrder: 'asc' }],
          select: { id: true },
        })
        selectedCampusId = defaultCampus?.id || null
      }

      const where: Record<string, unknown> = {
        organizationId: orgId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      }

      // Scope by campus if we have one
      if (selectedCampusId) {
        where.campusId = selectedCampusId
      }

      const cacheKey = settingsCacheKey(orgId, `campus:${selectedCampusId || 'all'}:${includeInactive}`)
      const data = await getCached(cacheKey, async () => {
        const [buildings, areas, rooms] = await Promise.all([
          db.building.findMany({
            where,
            include: {
              school: { select: { id: true, name: true, gradeLevel: true, color: true } },
              campus: { select: { id: true, name: true, campusType: true } },
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          }),
          db.area.findMany({
            where,
            include: {
              building: { select: { id: true, name: true, code: true } },
              campus: { select: { id: true, name: true, campusType: true } },
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          }),
          db.room.findMany({
            where: {
              organizationId: orgId,
              deletedAt: null,
              ...(includeInactive ? {} : { isActive: true }),
              ...(selectedCampusId ? { building: { campusId: selectedCampusId } } : {}),
            },
            include: {
              building: { select: { id: true, name: true, code: true } },
              area: { select: { id: true, name: true, areaType: true } },
            },
            orderBy: [{ sortOrder: 'asc' }, { roomNumber: 'asc' }],
          }),
        ])
        return { buildings, areas, rooms, campusId: selectedCampusId }
      })

      return NextResponse.json(ok(data))
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
