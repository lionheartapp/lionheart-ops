import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext } from '@/lib/org-context'
import { verifyAuthToken } from '@/lib/auth'

/** GET /api/campus/lookup — returns buildings, areas, rooms for the current org. */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
  }
  const claims = await verifyAuthToken(token)
  if (!claims) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid or expired token'), { status: 401 })
  }
  return runWithOrgContext(claims.organizationId, async () => {
    const [buildings, areas, rooms] = await Promise.all([
      prisma.building.findMany({
        where: { organizationId: claims.organizationId },
        select: { id: true, name: true, code: true, schoolDivision: true, isActive: true, sortOrder: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.area.findMany({
        where: { organizationId: claims.organizationId },
        select: { id: true, name: true, areaType: true, buildingId: true, isActive: true, sortOrder: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.room.findMany({
        where: { organizationId: claims.organizationId },
        select: {
          id: true,
          buildingId: true,
          areaId: true,
          roomNumber: true,
          displayName: true,
          floor: true,
          isActive: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { roomNumber: 'asc' }],
      }),
    ])
    return NextResponse.json(ok({ buildings, areas, rooms }))
  })
}
