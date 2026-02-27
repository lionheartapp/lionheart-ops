/**
 * Campus Map Data API
 *
 * GET /api/settings/campus/map-data
 * Returns org + building coordinates for the campus map embed.
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
      // Use raw queries for new lat/lng fields until Prisma client is regenerated
      const orgRows = await rawPrisma.$queryRaw<Array<{
        latitude: number | null
        longitude: number | null
        name: string
        physicalAddress: string | null
      }>>`
        SELECT latitude, longitude, name, "physicalAddress"
        FROM "Organization"
        WHERE id = ${orgId}
        LIMIT 1
      `

      const buildingRows = await rawPrisma.$queryRaw<Array<{
        id: string
        name: string
        code: string | null
        latitude: number | null
        longitude: number | null
        polygonCoordinates: unknown | null
      }>>`
        SELECT id, name, code, latitude, longitude, "polygonCoordinates"
        FROM "Building"
        WHERE "organizationId" = ${orgId}
          AND "isActive" = true
          AND "deletedAt" IS NULL
        ORDER BY "sortOrder" ASC, name ASC
      `

      const outdoorRows = await rawPrisma.$queryRaw<Array<{
        id: string
        name: string
        areaType: string
        latitude: number | null
        longitude: number | null
        polygonCoordinates: unknown | null
      }>>`
        SELECT id, name, "areaType", latitude, longitude, "polygonCoordinates"
        FROM "Area"
        WHERE "organizationId" = ${orgId}
          AND "buildingId" IS NULL
          AND "isActive" = true
          AND "deletedAt" IS NULL
        ORDER BY "sortOrder" ASC, name ASC
      `

      const org = orgRows[0] || null

      return NextResponse.json(ok({
        org: org ? {
          lat: org.latitude,
          lng: org.longitude,
          name: org.name,
          address: org.physicalAddress,
        } : null,
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
    const { latitude, longitude } = body

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json(fail('VALIDATION_ERROR', 'latitude and longitude are required numbers'), { status: 400 })
    }

    await rawPrisma.$executeRaw`
      UPDATE "Organization"
      SET latitude = ${latitude}, longitude = ${longitude}, "updatedAt" = NOW()
      WHERE id = ${orgId}
    `

    return NextResponse.json(ok({ latitude, longitude }))
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
