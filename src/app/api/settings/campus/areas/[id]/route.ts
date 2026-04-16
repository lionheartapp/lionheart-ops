import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { prisma, rawPrisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { invalidateOrgCache } from '@/lib/cache/settings-cache'

const UpdateAreaSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  areaType: z.enum(['FIELD', 'COURT', 'GYM', 'COMMON', 'PARKING', 'OTHER']).optional(),
  buildingId: z.string().optional().nullable(),
  /** M:N school scoping. Empty array = shared with all schools. Undefined = leave unchanged. */
  schoolIds: z.array(z.string()).optional(),
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

  const area = await prisma.area.findFirst({
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


  const existing = await prisma.area.findFirst({ where: { id, organizationId: orgId }, select: { id: true, campusId: true } })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Area not found'), { status: 404 })
  }

  if (input.buildingId) {
    const building = await prisma.building.findFirst({
      where: { id: input.buildingId, organizationId: orgId },
      select: { id: true },
    })
    if (!building) {
      return NextResponse.json(fail('BAD_REQUEST', 'Invalid buildingId for this organization'), { status: 400 })
    }
  }

  const { schoolIds, ...fieldInput } = input

  if (schoolIds !== undefined) {
    if (schoolIds.length > 0) {
      const valid = await prisma.school.findMany({
        where: { id: { in: schoolIds }, organizationId: orgId, campusId: existing.campusId, deletedAt: null },
        select: { id: true },
      })
      if (valid.length !== schoolIds.length) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'One or more schools do not belong to this campus'),
          { status: 400 }
        )
      }
    }
    await prisma.areaSchool.deleteMany({ where: { areaId: id } })
    if (schoolIds.length > 0) {
      await prisma.areaSchool.createMany({
        data: schoolIds.map((schoolId) => ({ areaId: id, schoolId })),
        skipDuplicates: true,
      })
    }
  }

  const area = await prisma.area.update({
    where: { id },
    data: Object.fromEntries(Object.entries(fieldInput).filter(([, v]) => v !== undefined)) as Prisma.AreaUpdateInput,
    include: {
      building: { select: { id: true, name: true, code: true } },
      schoolLinks: {
        select: { school: { select: { id: true, name: true, gradeLevel: true, color: true } } },
      },
    },
  })

  invalidateOrgCache(orgId)

  const { schoolLinks, ...rest } = area
  const result = { ...rest, schools: schoolLinks.map((l) => l.school) }

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateAreaSchema })

export const DELETE = withAuth<unknown, { id: string }>(async ({ orgId, params, searchParams }) => {
  const { id } = params
  const permanent = searchParams.get('permanent') === 'true'


  const existing = await prisma.area.findFirst({ where: { id, organizationId: orgId }, select: { id: true } })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Area not found'), { status: 404 })
  }

  if (permanent) {
    // Hard delete: use rawPrisma to bypass soft-delete extension
    await rawPrisma.area.delete({ where: { id } })
    invalidateOrgCache(orgId)
    return NextResponse.json(ok({ id, deleted: true }))
  } else {
    // Soft deactivate
    const area = await prisma.area.update({ where: { id }, data: { isActive: false } })
    invalidateOrgCache(orgId)
    return NextResponse.json(ok(area))
  }
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
