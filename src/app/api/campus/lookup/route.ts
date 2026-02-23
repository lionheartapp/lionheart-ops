import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      const db = prisma as any

      const [buildings, unassignedAreas] = await Promise.all([
        db.building.findMany({
          where: { organizationId: orgId, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            code: true,
            schoolDivision: true,
            areas: {
              where: { isActive: true },
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              select: {
                id: true,
                name: true,
                areaType: true,
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
              where: { isActive: true, areaId: null },
              orderBy: [{ sortOrder: 'asc' }, { roomNumber: 'asc' }],
              select: {
                id: true,
                roomNumber: true,
                displayName: true,
                floor: true,
                areaId: true,
              },
            },
          },
        }),
        db.area.findMany({
          where: { organizationId: orgId, isActive: true, buildingId: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            areaType: true,
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

      return NextResponse.json(ok({
        buildings,
        unassignedAreas,
      }))
    })
  } catch (error) {
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
