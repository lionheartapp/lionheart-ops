import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { withAuth } from '@/lib/api/with-auth'
import { invalidateOrgCache } from '@/lib/cache/settings-cache'

/**
 * Rooms are always children of a Building. They may optionally reference a
 * Space (field / court / common area) for logical grouping. The old `areaId`
 * foreign key was renamed to `spaceId` in Phase 1b.
 */
const CreateRoomSchema = z.object({
  buildingId: z.string().min(1),
  spaceId: z.string().optional().nullable(),
  roomNumber: z.string().trim().min(1).max(60),
  displayName: z.string().trim().min(1).max(120).optional().nullable(),
  floor: z.string().trim().min(1).max(40).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const includeInactive = searchParams.get('includeInactive') === 'true'
  const buildingId = searchParams.get('buildingId') || undefined
  // Accept both `spaceId` (preferred) and legacy `areaId` for backward compat
  const spaceId = searchParams.get('spaceId') || searchParams.get('areaId') || undefined

  const rooms = await prisma.room.findMany({
    where: {
      organizationId: orgId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(buildingId ? { buildingId } : {}),
      ...(spaceId ? { spaceId } : {}),
    },
    include: {
      building: { select: { id: true, name: true, code: true } },
      space: { select: { id: true, name: true, spaceType: true } },
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

  if (body.spaceId) {
    const space = await prisma.space.findFirst({
      where: { id: body.spaceId, organizationId: orgId },
      select: { id: true },
    })
    if (!space) {
      return NextResponse.json(fail('BAD_REQUEST', 'Invalid spaceId for this organization'), { status: 400 })
    }
  }

  const room = await prisma.room.create({
    data: {
      organizationId: orgId,
      buildingId: body.buildingId,
      spaceId: body.spaceId || null,
      roomNumber: body.roomNumber,
      displayName: body.displayName || null,
      floor: body.floor || null,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true,
    },
    include: {
      building: { select: { id: true, name: true, code: true } },
      space: { select: { id: true, name: true, spaceType: true } },
    },
  })

  invalidateOrgCache(orgId)

  return NextResponse.json(ok(room), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateRoomSchema })
