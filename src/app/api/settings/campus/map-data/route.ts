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
      }>>`
        SELECT id, name, code, latitude, longitude
        FROM "Building"
        WHERE "organizationId" = ${orgId}
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
