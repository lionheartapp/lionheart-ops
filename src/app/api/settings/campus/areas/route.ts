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
  return runWithOrgContext(orgId, async () => {
    const list = await prisma.area.findMany({
      where: { organizationId: orgId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(ok(list))
  })
}

export async function POST(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)
  const body = (await req.json()) as { name?: string; areaType?: string; buildingId?: string | null }
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json(fail('BAD_REQUEST', 'name is required'), { status: 400 })
  }
  return runWithOrgContext(orgId, async () => {
    const created = await prisma.area.create({
      data: {
        organizationId: orgId,
        name,
        areaType: (body.areaType as 'FIELD' | 'COURT' | 'GYM' | 'COMMON' | 'PARKING' | 'OTHER') || 'OTHER',
        buildingId: body.buildingId?.trim() || null,
      },
    })
    return NextResponse.json(ok(created), { status: 201 })
  })
}
