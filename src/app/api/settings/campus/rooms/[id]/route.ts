import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { withAuth } from '@/lib/api/with-auth'

const UpdateRoomSchema = z.object({
  buildingId: z.string().min(1).optional(),
  areaId: z.string().optional().nullable(),
  roomNumber: z.string().trim().min(1).max(60).optional(),
  displayName: z.string().trim().min(1).max(120).optional().nullable(),
  floor: z.string().trim().min(1).max(40).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const GET = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const db = prisma as any
  const room = await db.room.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: {
      building: { select: { id: true, name: true, code: true } },
      area: { select: { id: true, name: true, areaType: true } },
    },
  })

  if (!room) {
    return NextResponse.json(fail('NOT_FOUND', 'Room not found'), { status: 404 })
  }

  return NextResponse.json(ok(room))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<z.infer<typeof UpdateRoomSchema>, { id: string }>(async ({ orgId, params, body }) => {
  const db = prisma as any

  const existing = await db.room.findFirst({ where: { id: params.id, organizationId: orgId }, select: { id: true } })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Room not found'), { status: 404 })
  }

  if (body.buildingId) {
    const building = await db.building.findFirst({
      where: { id: body.buildingId, organizationId: orgId },
      select: { id: true },
    })
    if (!building) {
      return NextResponse.json(fail('BAD_REQUEST', 'Invalid buildingId for this organization'), { status: 400 })
    }
  }

  if (body.areaId) {
    const area = await db.area.findFirst({
      where: { id: body.areaId, organizationId: orgId },
      select: { id: true },
    })
    if (!area) {
      return NextResponse.json(fail('BAD_REQUEST', 'Invalid areaId for this organization'), { status: 400 })
    }
  }

  const room = await db.room.update({
    where: { id: params.id },
    data: {
      ...(body.buildingId !== undefined ? { buildingId: body.buildingId } : {}),
      ...(body.areaId !== undefined ? { areaId: body.areaId || null } : {}),
      ...(body.roomNumber !== undefined ? { roomNumber: body.roomNumber } : {}),
      ...(body.displayName !== undefined ? { displayName: body.displayName || null } : {}),
      ...(body.floor !== undefined ? { floor: body.floor || null } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    include: {
      building: { select: { id: true, name: true, code: true } },
      area: { select: { id: true, name: true, areaType: true } },
    },
  })

  return NextResponse.json(ok(room))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateRoomSchema })

export const DELETE = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const db = prisma as any
  const existing = await db.room.findFirst({ where: { id: params.id, organizationId: orgId }, select: { id: true } })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Room not found'), { status: 404 })
  }

  const room = await db.room.update({ where: { id: params.id }, data: { isActive: false } })
  return NextResponse.json(ok(room))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
