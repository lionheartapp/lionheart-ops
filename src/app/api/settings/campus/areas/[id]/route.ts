import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma, rawPrisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

type RouteParams = {
  params: Promise<{ id: string }>
}

const UpdateAreaSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  areaType: z.enum(['FIELD', 'COURT', 'GYM', 'COMMON', 'PARKING', 'OTHER']).optional(),
  buildingId: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  polygonCoordinates: z.array(z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })).min(3).optional().nullable(),
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
      const area = await db.area.findFirst({
        where: { id, organizationId: orgId },
        include: { building: { select: { id: true, name: true, code: true } } },
      })

      if (!area) {
        return NextResponse.json(fail('NOT_FOUND', 'Area not found'), { status: 404 })
      }

      return NextResponse.json(ok(area))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch area'), { status: 500 })
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
      const input = UpdateAreaSchema.parse(body)
      const db = prisma as any

      const existing = await db.area.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'Area not found'), { status: 404 })
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

      const area = await db.area.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.areaType !== undefined ? { areaType: input.areaType } : {}),
          ...(input.buildingId !== undefined ? { buildingId: input.buildingId || null } : {}),
          ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
          ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
          ...(input.polygonCoordinates !== undefined ? { polygonCoordinates: input.polygonCoordinates } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        include: {
          building: { select: { id: true, name: true, code: true } },
        },
      })

      return NextResponse.json(ok(area))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update area'), { status: 500 })
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
      const db = prisma as any
      const existing = await db.area.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
      if (!existing) {
        return NextResponse.json(fail('NOT_FOUND', 'Area not found'), { status: 404 })
      }

      if (permanent) {
        // Hard delete: use rawPrisma to bypass soft-delete extension
        await (rawPrisma as any).area.delete({ where: { id } })
        return NextResponse.json(ok({ id, deleted: true }))
      } else {
        // Soft deactivate
        const area = await db.area.update({ where: { id }, data: { isActive: false } })
        return NextResponse.json(ok(area))
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete area'), { status: 500 })
  }
}
