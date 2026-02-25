import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)
  const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true'
  return runWithOrgContext(orgId, async () => {
    const list = await prisma.room.findMany({
      where: {
        organizationId: orgId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { roomNumber: 'asc' }],
    })
    return NextResponse.json(ok(list))
  })
}

export async function POST(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)
  const body = (await req.json()) as {
    buildingId?: string
    areaId?: string | null
    roomNumber?: string
    displayName?: string | null
    floor?: string | null
  }
  const buildingId = body.buildingId?.trim()
  const roomNumber = body.roomNumber?.trim()
  if (!buildingId || !roomNumber) {
    return NextResponse.json(fail('BAD_REQUEST', 'buildingId and roomNumber are required'), { status: 400 })
  }
  return runWithOrgContext(orgId, async () => {
    const created = await prisma.room.create({
      data: {
        organizationId: orgId,
        buildingId,
        areaId: body.areaId?.trim() || null,
        roomNumber,
        displayName: body.displayName?.trim() || null,
        floor: body.floor?.trim() || null,
      },
    })
    return NextResponse.json(ok(created), { status: 201 })
  })
}
