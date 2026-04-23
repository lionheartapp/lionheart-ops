import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma, type PrismaDelegate } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      const db = prisma as unknown as Record<string, PrismaDelegate>

      const [buildings, unassignedSpaces] = await Promise.all([
        db.building.findMany({
          where: { organizationId: orgId, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            code: true,
            schoolDivision: true,
            spaces: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              select: {
                id: true,
                name: true,
                spaceType: true,
                rooms: {
                  where: { isActive: true },
                  orderBy: [{ sortOrder: 'asc' }, { roomNumber: 'asc' }],
                  select: {
                    id: true,
                    roomNumber: true,
                    displayName: true,
                    floor: true,
                  },
                },
              },
            },
            rooms: {
              where: { isActive: true, spaceId: null },
              orderBy: [{ sortOrder: 'asc' }, { roomNumber: 'asc' }],
              select: {
                id: true,
                roomNumber: true,
                displayName: true,
                floor: true,
                spaceId: true,
              },
            },
          },
        }),
        db.space.findMany({
          where: { organizationId: orgId, isActive: true, buildingId: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            spaceType: true,
            rooms: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { roomNumber: 'asc' }],
              select: {
                id: true,
                roomNumber: true,
                displayName: true,
                floor: true,
              },
            },
          },
        }),
      ])

      // Backward-compat: emit `areas`/`unassignedAreas` aliases alongside the new names
      const buildingsWithCompat = buildings.map((b: Record<string, unknown>) => ({
        ...b,
        areas: b.spaces,
      }))

      return NextResponse.json(ok({
        buildings: buildingsWithCompat,
        unassignedSpaces,
        // Backward-compat alias
        unassignedAreas: unassignedSpaces,
      }))
    })
  } catch (error) {
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Internal server error'),
      { status: 500 }
    )
  }
}
