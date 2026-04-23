import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { getCached, settingsCacheKey } from '@/lib/cache/settings-cache'

/**
 * GET /api/settings/campus
 *
 * Returns buildings, spaces, and rooms for a campus in a single request,
 * running all three DB queries in parallel after a single auth + permission check.
 *
 * Accepts optional ?campusId= to scope data to a specific campus.
 * If campusId is not provided, defaults to the HQ / first active campus.
 *
 * NOTE (Phase 1b ontology): Buildings are polymorphic — they can belong to a
 * District, School, or Campus. This endpoint only returns buildings directly
 * under the selected Campus. The parent school/district hierarchy is returned
 * separately via their respective APIs.
 */
export const GET = withAuth(async ({ orgId, searchParams }) => {
  const includeInactive = searchParams.get('includeInactive') === 'true'
  const campusId = searchParams.get('campusId')

  // If campusId not specified, find the default (HQ) campus
  let selectedCampusId = campusId
  if (!selectedCampusId) {
    const defaultCampus = await prisma.campus.findFirst({
      where: { organizationId: orgId, deletedAt: null, isActive: true },
      orderBy: [{ campusKind: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true },
    })
    selectedCampusId = defaultCampus?.id || null
  }

  const baseWhere: Record<string, unknown> = {
    organizationId: orgId,
    deletedAt: null,
    ...(includeInactive ? {} : { isActive: true }),
  }

  // Scope buildings + spaces by campus if we have one
  const scopedWhere = selectedCampusId
    ? { ...baseWhere, campusId: selectedCampusId }
    : baseWhere

  const cacheKey = settingsCacheKey(orgId, `campus:${selectedCampusId || 'all'}:${includeInactive}`)
  const data = await getCached(cacheKey, async () => {
    const [buildings, spaces, rooms] = await Promise.all([
      prisma.building.findMany({
        where: scopedWhere,
        include: {
          school: { select: { id: true, name: true, color: true } },
          district: { select: { id: true, name: true } },
          campus: { select: { id: true, name: true, campusKind: true } },
          site: { select: { id: true, label: true, address: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.space.findMany({
        where: scopedWhere,
        include: {
          building: { select: { id: true, name: true, code: true } },
          campus: { select: { id: true, name: true, campusKind: true } },
          school: { select: { id: true, name: true, color: true } },
          district: { select: { id: true, name: true } },
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
          space: { select: { id: true, name: true, spaceType: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { roomNumber: 'asc' }],
      }),
    ])

    return { buildings, spaces, rooms, campusId: selectedCampusId }
  })

  return NextResponse.json(ok(data))
}, { permission: PERMISSIONS.SETTINGS_READ })
