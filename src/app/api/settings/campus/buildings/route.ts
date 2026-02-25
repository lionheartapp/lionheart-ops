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
    const list = await prisma.building.findMany({
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
  const body = (await req.json()) as { name?: string; code?: string | null; schoolDivision?: string }
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json(fail('BAD_REQUEST', 'name is required'), { status: 400 })
  }
  return runWithOrgContext(orgId, async () => {
    const created = await prisma.building.create({
      data: {
        organizationId: orgId,
        name,
        code: body.code?.trim() || null,
        schoolDivision: (body.schoolDivision as 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL') || 'GLOBAL',
      },
    })
    return NextResponse.json(ok(created), { status: 201 })
  })
}
