import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma, rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

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

export const GET = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const building = await prisma.building.findFirst({ where: { id: params.id, organizationId: orgId } })

  if (!building) {
    return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
  }

  return NextResponse.json(ok(building))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<unknown, { id: string }>(async ({ req, orgId, params }) => {
  const body = await req.json()
  const input = UpdateBuildingSchema.parse(body)

  const existing = await prisma.building.findFirst({ where: { id: params.id, organizationId: orgId }, select: { id: true } })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
  }

  const building = await prisma.building.update({
    where: { id: params.id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spread pattern creates union type incompatible with Prisma's strict UpdateInput
    data: Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as any,
    include: { school: { select: { id: true, name: true, gradeLevel: true, color: true } } },
  })

  return NextResponse.json(ok(building))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })

export const DELETE = withAuth<unknown, { id: string }>(async ({ orgId, params, searchParams }) => {
  const permanent = searchParams.get('permanent') === 'true'

  const existing = await prisma.building.findFirst({ where: { id: params.id, organizationId: orgId }, select: { id: true } })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
  }

  if (permanent) {
    // Hard delete: use rawPrisma to bypass soft-delete extension
    await rawPrisma.room.deleteMany({ where: { buildingId: params.id, organizationId: orgId } })
    await rawPrisma.area.updateMany({ where: { buildingId: params.id, organizationId: orgId }, data: { buildingId: null } })
    await rawPrisma.building.delete({ where: { id: params.id } })
    return NextResponse.json(ok({ id: params.id, deleted: true }))
  } else {
    // Soft deactivate
    const building = await prisma.building.update({ where: { id: params.id }, data: { isActive: false } })
    return NextResponse.json(ok(building))
  }
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
