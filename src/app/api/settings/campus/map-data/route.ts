/**
 * Campus Map Data API
 *
 * GET /api/settings/campus/map-data
 * Returns campus center + building coordinates for the campus map embed.
 * Accepts optional ?campusId= to scope to a specific campus.
 * If not provided, defaults to the HQ/first campus.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const campusId = searchParams.get('campusId')

      // If campusId specified, use campus coords for map center
      // Otherwise fall back to HQ campus, then org coords
      let mapCenter: { lat: number | null; lng: number | null; name: string; address: string | null } | null = null
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
          ORDER BY "campusType" ASC, "sortOrder" ASC
          LIMIT 1
        `
        const hq = hqRows[0]
        if (hq) {
          selectedCampusId = hq.id
          mapCenter = { lat: hq.latitude, lng: hq.longitude, name: hq.name, address: hq.address }
        }
      }

      // Fallback to org coords if no campus found
      if (!mapCenter) {
        const orgRows = await rawPrisma.$queryRaw<Array<{
          latitude: number | null; longitude: number | null; name: string; physicalAddress: string | null
        }>>`
          SELECT latitude, longitude, name, "physicalAddress"
          FROM "Organization"
          WHERE id = ${orgId}
          LIMIT 1
        `
        const org = orgRows[0]
        if (org) {
          mapCenter = { lat: org.latitude, lng: org.longitude, name: org.name, address: org.physicalAddress }
        }
      }

      // Scope buildings and areas by campus if available
      let buildingRows: Array<{
        id: string; name: string; code: string | null
        latitude: number | null; longitude: number | null; polygonCoordinates: unknown | null
      }>
      let outdoorRows: Array<{
        id: string; name: string; areaType: string
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
          SELECT id, name, "areaType", latitude, longitude, "polygonCoordinates"
          FROM "Area"
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
          SELECT id, name, "areaType", latitude, longitude, "polygonCoordinates"
          FROM "Area"
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
        outdoorSpaces: outdoorRows.map(a => ({
          id: a.id,
          name: a.name,
          areaType: a.areaType,
          lat: a.latitude,
          lng: a.longitude,
          polygonCoordinates: a.polygonCoordinates || null,
        })),
      }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch map data'), { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

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
      // Fallback: update org coords (backward compat)
      await rawPrisma.$executeRaw`
        UPDATE "Organization"
        SET latitude = ${latitude}, longitude = ${longitude}, "updatedAt" = NOW()
        WHERE id = ${orgId}
      `
    }

    return NextResponse.json(ok({ latitude, longitude, campusId }))
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update map center'), { status: 500 })
  }
}
