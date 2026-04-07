import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { withAuth } from '@/lib/api/with-auth'

const CreateRoomSchema = z.object({
  buildingId: z.string().min(1),
  areaId: z.string().optional().nullable(),
  roomNumber: z.string().trim().min(1).max(60),
  displayName: z.string().trim().min(1).max(120).optional().nullable(),
  floor: z.string().trim().min(1).max(40).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const includeInactive = searchParams.get('includeInactive') === 'true'
  const buildingId = searchParams.get('buildingId') || undefined
  const areaId = searchParams.get('areaId') || undefined


  const rooms = await prisma.room.findMany({
    where: {
      organizationId: orgId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(buildingId ? { buildingId } : {}),
      ...(areaId ? { areaId } : {}),
    },
    include: {
      building: { select: { id: true, name: true, code: true } },
      area: { select: { id: true, name: true, areaType: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { roomNumber: 'asc' }],
  })

  return NextResponse.json(ok(rooms))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const POST = withAuth<z.infer<typeof CreateRoomSchema>>(async ({ orgId, body }) => {


  const building = await prisma.building.findFirst({
    where: { id: body.buildingId, organizationId: orgId },
    select: { id: true },
  })
  if (!building) {
    return NextResponse.json(fail('BAD_REQUEST', 'Invalid buildingId for this organization'), { status: 400 })
  }

  if (body.areaId) {
    const area = await prisma.area.findFirst({
      where: { id: body.areaId, organizationId: orgId },
      select: { id: true },
    })
    if (!area) {
      return NextResponse.json(fail('BAD_REQUEST', 'Invalid areaId for this organization'), { status: 400 })
    }
  }

  const room = await prisma.room.create({
    data: {
      organizationId: orgId,
      buildingId: body.buildingId,
      areaId: body.areaId || null,
      roomNumber: body.roomNumber,
      displayName: body.displayName || null,
      floor: body.floor || null,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true,
    },
    include: {
      building: { select: { id: true, name: true, code: true } },
      area: { select: { id: true, name: true, areaType: true } },
    },
  })

  return NextResponse.json(ok(room), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateRoomSchema })
