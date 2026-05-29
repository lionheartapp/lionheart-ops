/**
 * Campus Map Data API
 *
 * GET /api/settings/campus/map-data
 * Returns campus center + building coordinates for the campus map embed.
 * Accepts optional ?campusId= to scope to a specific campus.
 * If not provided, defaults to the HQ/first campus.
 *
 * Phase 1c note: the old fallback path queried `Organization.physicalAddress`,
 * `Organization.latitude`, and `Organization.longitude`. Those fields moved to
 * the School model in the ontology inversion. The fallback now pulls from the
 * primary (first-sorted, non-deleted) School record instead. Persisted writes
 * target that School rather than Organization.
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
// eslint-disable-next-line no-restricted-imports -- Map data uses raw SQL for lightweight coordinate projections and every query filters by organizationId.
import { rawPrisma } from '@/lib/db'
import { geocodeAddress } from '@/lib/services/geocodingService'

type MapCenter = {
  lat: number | null
  lng: number | null
  name: string
  address: string | null
}

/** Fetch the primary (first-sorted, non-deleted) School for an org, if any. */
async function getPrimarySchool(orgId: string) {
  return rawPrisma.school.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, address: true, latitude: true, longitude: true },
  })
}

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const campusId = searchParams.get('campusId')

  // If campusId specified, use campus coords for map center
  // Otherwise fall back to HQ campus, then the primary School.
  let mapCenter: MapCenter | null = null
  let selectedCampusId = campusId

  if (selectedCampusId) {
    // Use specified campus as map center
    const campusRows = await rawPrisma.$queryRaw<Array<{
      id: string; latitude: number | null; longitude: number | null; name: string; address: string | null
    }>>`
      SELECT id, latitude, longitude, name, address
      FROM "Campus"
      WHERE id = ${selectedCampusId} AND "organizationId" = ${orgId} AND "deletedAt" IS NULL
      LIMIT 1
    `
    const campus = campusRows[0]
    if (campus) {
      mapCenter = { lat: campus.latitude, lng: campus.longitude, name: campus.name, address: campus.address }
    }
  }

  if (!selectedCampusId) {
    // Find HQ campus
    const hqRows = await rawPrisma.$queryRaw<Array<{
      id: string; latitude: number | null; longitude: number | null; name: string; address: string | null
    }>>`
      SELECT id, latitude, longitude, name, address
      FROM "Campus"
      WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL AND "isActive" = true
      ORDER BY "campusKind" ASC, "sortOrder" ASC
      LIMIT 1
    `
    const hq = hqRows[0]
    if (hq) {
      selectedCampusId = hq.id
      mapCenter = { lat: hq.latitude, lng: hq.longitude, name: hq.name, address: hq.address }
    }
  }

  // Fallback to primary School if no campus found. School.address /
  // School.latitude / School.longitude replaced the old Organization
  // equivalents in the Phase 1c ontology inversion.
  if (!mapCenter) {
    const org = await rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    })
    const primarySchool = await getPrimarySchool(orgId)
    if (org) {
      mapCenter = {
        lat: primarySchool?.latitude ?? null,
        lng: primarySchool?.longitude ?? null,
        name: org.name,
        address: primarySchool?.address ?? null,
      }
    }
  }

  // If campus has no address, inherit from the primary School and persist it
  if (mapCenter && !mapCenter.address) {
    const primarySchool = await getPrimarySchool(orgId)
    if (primarySchool?.address) {
      mapCenter.address = primarySchool.address
      // Persist to the campus so future loads are instant
      if (selectedCampusId) {
        await rawPrisma.$executeRaw`
          UPDATE "Campus" SET address = ${primarySchool.address}, "updatedAt" = NOW()
          WHERE id = ${selectedCampusId} AND "organizationId" = ${orgId} AND address IS NULL
        `.catch(() => {})
      }
    }
  }

  // If campus has no coordinates, try to inherit from the primary School
  if (mapCenter && !mapCenter.lat && !mapCenter.lng) {
    const primarySchool = await getPrimarySchool(orgId)
    if (primarySchool?.latitude && primarySchool?.longitude) {
      mapCenter.lat = primarySchool.latitude
      mapCenter.lng = primarySchool.longitude
      // Persist to campus
      if (selectedCampusId) {
        await rawPrisma.$executeRaw`
          UPDATE "Campus" SET latitude = ${mapCenter.lat}, longitude = ${mapCenter.lng}, "updatedAt" = NOW()
          WHERE id = ${selectedCampusId} AND "organizationId" = ${orgId} AND latitude IS NULL
        `.catch(() => {})
      }
    }
  }

  // Auto-geocode if we have an address but no coordinates. Persisted writes go
  // to the campus (preferred) or the primary School (fallback).
  if (mapCenter && !mapCenter.lat && !mapCenter.lng && mapCenter.address) {
    const geo = await geocodeAddress(mapCenter.address)
    if (geo) {
      mapCenter.lat = geo.lat
      mapCenter.lng = geo.lng
      if (selectedCampusId) {
        await rawPrisma.$executeRaw`
          UPDATE "Campus" SET latitude = ${geo.lat}, longitude = ${geo.lng}, "updatedAt" = NOW()
          WHERE id = ${selectedCampusId} AND "organizationId" = ${orgId}
        `.catch(() => {})
      } else {
        const primarySchool = await getPrimarySchool(orgId)
        if (primarySchool) {
          await rawPrisma.$executeRaw`
            UPDATE "School" SET latitude = ${geo.lat}, longitude = ${geo.lng}, "updatedAt" = NOW()
            WHERE id = ${primarySchool.id}
          `.catch(() => {})
        }
      }
    }
  }

  // Scope buildings and outdoor spaces by campus if available. Space replaced
  // the old Area table (Phase 1c Pass 4); column renamed from areaType to
  // spaceType at the same time.
  let buildingRows: Array<{
    id: string; name: string; code: string | null
    latitude: number | null; longitude: number | null; polygonCoordinates: unknown | null
  }>
  let outdoorRows: Array<{
    id: string; name: string; spaceType: string
    latitude: number | null; longitude: number | null; polygonCoordinates: unknown | null
  }>

  if (selectedCampusId) {
    buildingRows = await rawPrisma.$queryRaw`
      SELECT id, name, code, latitude, longitude, "polygonCoordinates"
      FROM "Building"
      WHERE "organizationId" = ${orgId}
        AND "isActive" = true
        AND "deletedAt" IS NULL
        AND "campusId" = ${selectedCampusId}
      ORDER BY "sortOrder" ASC, name ASC
    `
    outdoorRows = await rawPrisma.$queryRaw`
      SELECT id, name, "spaceType", latitude, longitude, "polygonCoordinates"
      FROM "Space"
      WHERE "organizationId" = ${orgId}
        AND "buildingId" IS NULL
        AND "isActive" = true
        AND "deletedAt" IS NULL
        AND "campusId" = ${selectedCampusId}
      ORDER BY "sortOrder" ASC, name ASC
    `
  } else {
    buildingRows = await rawPrisma.$queryRaw`
      SELECT id, name, code, latitude, longitude, "polygonCoordinates"
      FROM "Building"
      WHERE "organizationId" = ${orgId}
        AND "isActive" = true
        AND "deletedAt" IS NULL
      ORDER BY "sortOrder" ASC, name ASC
    `
    outdoorRows = await rawPrisma.$queryRaw`
      SELECT id, name, "spaceType", latitude, longitude, "polygonCoordinates"
      FROM "Space"
      WHERE "organizationId" = ${orgId}
        AND "buildingId" IS NULL
        AND "isActive" = true
        AND "deletedAt" IS NULL
      ORDER BY "sortOrder" ASC, name ASC
    `
  }

  return NextResponse.json(ok({
    org: mapCenter,
    campusId: selectedCampusId,
    buildings: buildingRows
      .filter(b => b.latitude && b.longitude)
      .map(b => ({
        id: b.id,
        name: b.name,
        code: b.code,
        lat: b.latitude,
        lng: b.longitude,
        polygonCoordinates: b.polygonCoordinates || null,
      })),
    outdoorSpaces: outdoorRows.map(s => ({
      id: s.id,
      name: s.name,
      // Client still expects `areaType` for backward compat; alias spaceType
      // onto that shape until the consumer component migrates.
      areaType: s.spaceType,
      spaceType: s.spaceType,
      lat: s.latitude,
      lng: s.longitude,
      polygonCoordinates: s.polygonCoordinates || null,
    })),
  }))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth(async ({ req, orgId }) => {
  const body = await req.json()
  const { latitude, longitude, campusId } = body

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return NextResponse.json(fail('VALIDATION_ERROR', 'latitude and longitude are required numbers'), { status: 400 })
  }

  if (campusId) {
    // Update campus coords
    await rawPrisma.$executeRaw`
      UPDATE "Campus"
      SET latitude = ${latitude}, longitude = ${longitude}, "updatedAt" = NOW()
      WHERE id = ${campusId} AND "organizationId" = ${orgId}
    `
  } else {
    // Fallback: persist onto the primary School. Previously this wrote to
    // Organization.latitude/longitude — those columns were removed in the
    // Phase 1c ontology inversion.
    const primarySchool = await rawPrisma.school.findFirst({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    })
    if (primarySchool) {
      await rawPrisma.$executeRaw`
        UPDATE "School"
        SET latitude = ${latitude}, longitude = ${longitude}, "updatedAt" = NOW()
        WHERE id = ${primarySchool.id}
      `
    }
  }

  return NextResponse.json(ok({ latitude, longitude, campusId }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
