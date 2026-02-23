import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

type RouteParams = {
  params: Promise<{ id: string }>
}

const UpdateRoomSchema = z.object({
  buildingId: z.string().min(1).optional(),
  areaId: z.string().optional().nullable(),
  roomNumber: z.string().trim().min(1).max(60).optional(),
  displayName: z.string().trim().min(1).max(120).optional().nullable(),
  floor: z.string().trim().min(1).max(40).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const db = prisma as any
      const room = await db.room.findFirst({
        where: { id, organizationId: orgId },
        include: {
          building: { select: { id: true, name: true, code: true } },
          area: { select: { id: true, name: true, areaType: true } },
        },
      })

      if (!room) {
        return NextResponse.json(fail('NOT_FOUND', 'Room not found'), { status: 404 })
      }

      return NextResponse.json(ok(room))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch room'), { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const input = UpdateRoomSchema.parse(body)
      const db = prisma as any

      const existing = await db.room.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'Room not found'), { status: 404 })
      }

      if (input.buildingId) {
        const building = await db.building.findFirst({
          where: { id: input.buildingId, organizationId: orgId },
          select: { id: true },
        })
        if (!building) {
          return NextResponse.json(fail('BAD_REQUEST', 'Invalid buildingId for this organization'), { status: 400 })
        }
      }

      if (input.areaId) {
        const area = await db.area.findFirst({
          where: { id: input.areaId, organizationId: orgId },
          select: { id: true },
        })
        if (!area) {
          return NextResponse.json(fail('BAD_REQUEST', 'Invalid areaId for this organization'), { status: 400 })
        }
      }

      const room = await db.room.update({
        where: { id },
        data: {
          ...(input.buildingId !== undefined ? { buildingId: input.buildingId } : {}),
          ...(input.areaId !== undefined ? { areaId: input.areaId || null } : {}),
          ...(input.roomNumber !== undefined ? { roomNumber: input.roomNumber } : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName || null } : {}),
          ...(input.floor !== undefined ? { floor: input.floor || null } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        include: {
          building: { select: { id: true, name: true, code: true } },
          area: { select: { id: true, name: true, areaType: true } },
        },
      })

      return NextResponse.json(ok(room))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update room'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const db = prisma as any
      const existing = await db.room.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'Room not found'), { status: 404 })
      }

      const room = await db.room.update({ where: { id }, data: { isActive: false } })
      return NextResponse.json(ok(room))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete room'), { status: 500 })
  }
}
