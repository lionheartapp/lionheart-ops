import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

type RouteParams = {
  params: Promise<{ id: string }>
}

const UpdateBuildingSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(30).optional().nullable(),
  schoolId: z.string().optional().nullable(),
  schoolDivision: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'GLOBAL']).optional(),
  buildingType: z.enum(['GENERAL', 'ARTS_CULTURE', 'ATHLETICS', 'ADMINISTRATION', 'SUPPORT_SERVICES']).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  polygonCoordinates: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })).min(3).optional().nullable(),
})

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const building = await (rawPrisma as any).building.findFirst({ where: { id, organizationId: orgId } })

      if (!building) {
        return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
      }

      return NextResponse.json(ok(building))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch building'), { status: 500 })
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
      const input = UpdateBuildingSchema.parse(body)

      const existing = await (rawPrisma as any).building.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
      }

      const building = await (rawPrisma as any).building.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.code !== undefined ? { code: input.code || null } : {}),
          ...(input.schoolId !== undefined ? { schoolId: input.schoolId || null } : {}),
          ...(input.schoolDivision !== undefined ? { schoolDivision: input.schoolDivision } : {}),
          ...(input.buildingType !== undefined ? { buildingType: input.buildingType } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
          ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
          ...(input.polygonCoordinates !== undefined ? { polygonCoordinates: input.polygonCoordinates } : {}),
        },
        include: { school: { select: { id: true, name: true, gradeLevel: true } } },
      })

      return NextResponse.json(ok(building))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update building'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    const url = new URL(req.url)
    const permanent = url.searchParams.get('permanent') === 'true'

    return await runWithOrgContext(orgId, async () => {
      const existing = await (rawPrisma as any).building.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
      }

      if (permanent) {
        // Hard delete: remove rooms first, nullify area refs, then delete building
        await (rawPrisma as any).room.deleteMany({ where: { buildingId: id, organizationId: orgId } })
        await (rawPrisma as any).area.updateMany({ where: { buildingId: id, organizationId: orgId }, data: { buildingId: null } })
        await (rawPrisma as any).building.delete({ where: { id } })
        return NextResponse.json(ok({ id, deleted: true }))
      } else {
        // Soft deactivate (existing behavior)
        const building = await (rawPrisma as any).building.update({ where: { id }, data: { isActive: false } })
        return NextResponse.json(ok(building))
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete building'), { status: 500 })
  }
}
