import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)
  return runWithOrgContext(orgId, async () => {
    const area = await prisma.area.findFirst({ where: { id, organizationId: orgId } })
    if (!area) return NextResponse.json(fail('NOT_FOUND', 'Area not found'), { status: 404 })
    return NextResponse.json(ok(area))
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)
  const body = (await req.json()) as { name?: string; areaType?: string; buildingId?: string | null; isActive?: boolean }
  return runWithOrgContext(orgId, async () => {
    const existing = await prisma.area.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return NextResponse.json(fail('NOT_FOUND', 'Area not found'), { status: 404 })
    const updated = await prisma.area.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.areaType !== undefined && { areaType: body.areaType as 'FIELD' | 'COURT' | 'GYM' | 'COMMON' | 'PARKING' | 'OTHER' }),
        ...(body.buildingId !== undefined && { buildingId: body.buildingId?.trim() || null }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    })
    return NextResponse.json(ok(updated))
  })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)
  return runWithOrgContext(orgId, async () => {
    const existing = await prisma.area.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return NextResponse.json(fail('NOT_FOUND', 'Area not found'), { status: 404 })
    await prisma.area.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json(ok({ deleted: true }))
  })
}
