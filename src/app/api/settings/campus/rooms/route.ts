import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const CreateRoomSchema = z.object({
  buildingId: z.string().min(1),
  areaId: z.string().optional().nullable(),
  roomNumber: z.string().trim().min(1).max(60),
  displayName: z.string().trim().min(1).max(120).optional().nullable(),
  floor: z.string().trim().min(1).max(40).optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const searchParams = new URL(req.url).searchParams
      const includeInactive = searchParams.get('includeInactive') === 'true'
      const buildingId = searchParams.get('buildingId') || undefined
      const areaId = searchParams.get('areaId') || undefined
      const db = prisma as any

      const rooms = await db.room.findMany({
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
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch rooms'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateRoomSchema.parse(body)
      const db = prisma as any

      const building = await db.building.findFirst({
        where: { id: input.buildingId, organizationId: orgId },
        select: { id: true },
      })
      if (!building) {
        return NextResponse.json(fail('BAD_REQUEST', 'Invalid buildingId for this organization'), { status: 400 })
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

      const room = await db.room.create({
        data: {
          organizationId: orgId,
          buildingId: input.buildingId,
          areaId: input.areaId || null,
          roomNumber: input.roomNumber,
          displayName: input.displayName || null,
          floor: input.floor || null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        },
        include: {
          building: { select: { id: true, name: true, code: true } },
          area: { select: { id: true, name: true, areaType: true } },
        },
      })

      return NextResponse.json(ok(room), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create room'), { status: 500 })
  }
}
