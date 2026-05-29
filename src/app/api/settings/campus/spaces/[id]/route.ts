import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
// eslint-disable-next-line no-restricted-imports -- rawPrisma is only used for the explicit permanent delete path to bypass the soft-delete extension after org ownership is verified.
import { prisma, rawPrisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { invalidateOrgCache } from '@/lib/cache/settings-cache'

const UpdateSpaceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  spaceType: z
    .enum(['FIELD', 'COURT', 'GYM', 'COMMON', 'PARKING', 'PLAYGROUND', 'POOL', 'GARDEN', 'OTHER'])
    .optional(),
  buildingId: z.string().optional().nullable(),
  campusId: z.string().optional().nullable(),
  schoolId: z.string().optional().nullable(),
  districtId: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  polygonCoordinates: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
    )
    .min(3)
    .optional()
    .nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export const GET = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const { id } = params

  const space = await prisma.space.findFirst({
    where: { id, organizationId: orgId },
    include: {
      building: { select: { id: true, name: true, code: true } },
      campus: { select: { id: true, name: true, campusKind: true } },
      school: { select: { id: true, name: true, color: true } },
      district: { select: { id: true, name: true } },
    },
  })

  if (!space) {
    return NextResponse.json(fail('NOT_FOUND', 'Space not found'), { status: 404 })
  }

  return NextResponse.json(ok(space))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<z.infer<typeof UpdateSpaceSchema>, { id: string }>(
  async ({ orgId, body: input, params }) => {
    const { id } = params

    const existing = await prisma.space.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json(fail('NOT_FOUND', 'Space not found'), { status: 404 })
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
    if (input.campusId) {
      const campus = await prisma.campus.findFirst({
        where: { id: input.campusId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      })
      if (!campus) {
        return NextResponse.json(fail('NOT_FOUND', 'Campus not found'), { status: 404 })
      }
    }
    if (input.schoolId) {
      const school = await prisma.school.findFirst({
        where: { id: input.schoolId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      })
      if (!school) {
        return NextResponse.json(fail('NOT_FOUND', 'School not found'), { status: 404 })
      }
    }
    if (input.districtId) {
      const district = await prisma.district.findFirst({
        where: { id: input.districtId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      })
      if (!district) {
        return NextResponse.json(fail('NOT_FOUND', 'District not found'), { status: 404 })
      }
    }

    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.spaceType !== undefined) data.spaceType = input.spaceType
    if (input.buildingId !== undefined) data.buildingId = input.buildingId || null
    if (input.campusId !== undefined) data.campusId = input.campusId || null
    if (input.schoolId !== undefined) data.schoolId = input.schoolId || null
    if (input.districtId !== undefined) data.districtId = input.districtId || null
    if (input.latitude !== undefined) data.latitude = input.latitude
    if (input.longitude !== undefined) data.longitude = input.longitude
    if (input.polygonCoordinates !== undefined) {
      data.polygonCoordinates =
        input.polygonCoordinates != null
          ? (input.polygonCoordinates as Prisma.InputJsonValue)
          : Prisma.JsonNull
    }
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
    if (input.isActive !== undefined) data.isActive = input.isActive

    const space = await prisma.space.update({
      where: { id },
      data: data as Prisma.SpaceUpdateInput,
      include: {
        building: { select: { id: true, name: true, code: true } },
        campus: { select: { id: true, name: true, campusKind: true } },
        school: { select: { id: true, name: true, color: true } },
        district: { select: { id: true, name: true } },
      },
    })

    invalidateOrgCache(orgId)

    return NextResponse.json(ok(space))
  },
  { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateSpaceSchema },
)

export const DELETE = withAuth<unknown, { id: string }>(async ({ orgId, params, searchParams }) => {
  const { id } = params
  const permanent = searchParams.get('permanent') === 'true'

  const existing = await prisma.space.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Space not found'), { status: 404 })
  }

  if (permanent) {
    await rawPrisma.space.delete({ where: { id } })
    invalidateOrgCache(orgId)
    return NextResponse.json(ok({ id, deleted: true }))
  } else {
    const space = await prisma.space.update({ where: { id }, data: { isActive: false } })
    invalidateOrgCache(orgId)
    return NextResponse.json(ok(space))
  }
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
