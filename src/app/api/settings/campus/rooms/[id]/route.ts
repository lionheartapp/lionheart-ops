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
    const room = await prisma.room.findFirst({ where: { id, organizationId: orgId } })
    if (!room) return NextResponse.json(fail('NOT_FOUND', 'Room not found'), { status: 404 })
    return NextResponse.json(ok(room))
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)
  const body = (await req.json()) as {
    buildingId?: string
    areaId?: string | null
    roomNumber?: string
    displayName?: string | null
    floor?: string | null
    isActive?: boolean
  }
  return runWithOrgContext(orgId, async () => {
    const existing = await prisma.room.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return NextResponse.json(fail('NOT_FOUND', 'Room not found'), { status: 404 })
    const updated = await prisma.room.update({
      where: { id },
      data: {
        ...(body.buildingId !== undefined && { buildingId: body.buildingId.trim() }),
        ...(body.areaId !== undefined && { areaId: body.areaId?.trim() || null }),
        ...(body.roomNumber !== undefined && { roomNumber: body.roomNumber.trim() }),
        ...(body.displayName !== undefined && { displayName: body.displayName?.trim() || null }),
        ...(body.floor !== undefined && { floor: body.floor?.trim() || null }),
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
    const existing = await prisma.room.findFirst({ where: { id, organizationId: orgId } })
    if (!existing) return NextResponse.json(fail('NOT_FOUND', 'Room not found'), { status: 404 })
    await prisma.room.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json(ok({ deleted: true }))
  })
}
