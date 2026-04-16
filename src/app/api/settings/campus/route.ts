import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { getCached, settingsCacheKey } from '@/lib/cache/settings-cache'

/**
 * GET /api/settings/campus
 * Returns buildings, areas, and rooms in a single request, running all three
 * DB queries in parallel after a single auth + permission check.
 * Accepts optional ?campusId= to scope data to a specific campus.
 * If campusId is not provided, defaults to the HQ/first campus.
 */
export const GET = withAuth(async ({ orgId, searchParams }) => {
  const includeInactive = searchParams.get('includeInactive') === 'true'
  const campusId = searchParams.get('campusId')


  // If campusId not specified, find the default (HQ) campus
  let selectedCampusId = campusId
  if (!selectedCampusId) {
    const defaultCampus = await prisma.campus.findFirst({
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
      prisma.building.findMany({
        where,
        include: {
          school: { select: { id: true, name: true, gradeLevel: true, color: true } },
          campus: { select: { id: true, name: true, campusType: true } },
          schoolLinks: {
            select: { school: { select: { id: true, name: true, gradeLevel: true, color: true } } },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.area.findMany({
        where,
        include: {
          building: { select: { id: true, name: true, code: true } },
          campus: { select: { id: true, name: true, campusType: true } },
          schoolLinks: {
            select: { school: { select: { id: true, name: true, gradeLevel: true, color: true } } },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.room.findMany({
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

    // Flatten schoolLinks → schools array for easier client consumption
    const flatBuildings = buildings.map((b) => {
      const { schoolLinks, ...rest } = b
      return { ...rest, schools: schoolLinks.map((l) => l.school) }
    })
    const flatAreas = areas.map((a) => {
      const { schoolLinks, ...rest } = a
      return { ...rest, schools: schoolLinks.map((l) => l.school) }
    })

    return { buildings: flatBuildings, areas: flatAreas, rooms, campusId: selectedCampusId }
  })

  return NextResponse.json(ok(data))
}, { permission: PERMISSIONS.SETTINGS_READ })
