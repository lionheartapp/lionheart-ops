import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { prisma, rawPrisma } from '@/lib/db'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'

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

export const GET = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const { id } = params
  const db = prisma as any
  const area = await db.area.findFirst({
    where: { id, organizationId: orgId },
    include: { building: { select: { id: true, name: true, code: true } } },
  })

  if (!area) {
    return NextResponse.json(fail('NOT_FOUND', 'Area not found'), { status: 404 })
  }

  return NextResponse.json(ok(area))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<z.infer<typeof UpdateAreaSchema>, { id: string }>(async ({ orgId, body: input, params }) => {
  const { id } = params
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
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateAreaSchema })

export const DELETE = withAuth<unknown, { id: string }>(async ({ orgId, params, searchParams }) => {
  const { id } = params
  const permanent = searchParams.get('permanent') === 'true'
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
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
