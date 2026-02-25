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
    const building = await prisma.building.findFirst({ where: { id, organizationId: orgId } })
    if (!building) return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
    return NextResponse.json(ok(building))
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)
  const body = (await req.json()) as { name?: string; code?: string | null; schoolDivision?: string; isActive?: boolean }
  return runWithOrgContext(orgId, async () => {
    const existing = await prisma.building.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
    const updated = await prisma.building.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.code !== undefined && { code: body.code?.trim() || null }),
        ...(body.schoolDivision !== undefined && { schoolDivision: body.schoolDivision as 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL' }),
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
    const existing = await prisma.building.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
    await prisma.building.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json(ok({ deleted: true }))
  })
}
