import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { invalidateOrgCache } from '@/lib/cache/settings-cache'

/**
 * POST /api/settings/campus/spaces
 *
 * Creates a Space. Spaces are polymorphic — they may belong to exactly one of
 * (buildingId, campusId, schoolId, districtId). If none are supplied, this is
 * rejected — callers must pick a parent.
 *
 * The old `areaType` field was renamed to `spaceType` in Phase 1b, and the
 * M:N AreaSchool junction (`schoolLinks`) was removed in favor of a direct
 * polymorphic parent.
 */
const CreateSpaceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    spaceType: z
      .enum(['FIELD', 'COURT', 'GYM', 'COMMON', 'PARKING', 'PLAYGROUND', 'POOL', 'GARDEN', 'OTHER'])
      .optional(),
    // Polymorphic parent — at least one must be supplied
    buildingId: z.string().min(1).optional().nullable(),
    campusId: z.string().min(1).optional().nullable(),
    schoolId: z.string().min(1).optional().nullable(),
    districtId: z.string().min(1).optional().nullable(),
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
  .refine(
    (input) => {
      const parents = [input.buildingId, input.campusId, input.schoolId, input.districtId].filter(
        Boolean,
      ).length
      return parents >= 1
    },
    { message: 'A space must be pinned to at least one of: building, campus, school, or district.' },
  )

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const includeInactive = searchParams.get('includeInactive') === 'true'
  const buildingId = searchParams.get('buildingId') || undefined
  const campusId = searchParams.get('campusId') || undefined
  const schoolId = searchParams.get('schoolId') || undefined
  const districtId = searchParams.get('districtId') || undefined

  const spaces = await prisma.space.findMany({
    where: {
      organizationId: orgId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(buildingId ? { buildingId } : {}),
      ...(campusId ? { campusId } : {}),
      ...(schoolId ? { schoolId } : {}),
      ...(districtId ? { districtId } : {}),
    },
    include: {
      building: { select: { id: true, name: true, code: true } },
      campus: { select: { id: true, name: true, campusKind: true } },
      school: { select: { id: true, name: true, color: true } },
      district: { select: { id: true, name: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(ok(spaces))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const POST = withAuth<z.infer<typeof CreateSpaceSchema>>(async ({ orgId, body: input }) => {
  // Validate supplied parents exist in this org
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

  const space = await prisma.space.create({
    data: {
      organizationId: orgId,
      buildingId: input.buildingId || null,
      campusId: input.campusId || null,
      schoolId: input.schoolId || null,
      districtId: input.districtId || null,
      name: input.name,
      spaceType: input.spaceType || 'OTHER',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      polygonCoordinates:
        input.polygonCoordinates != null
          ? (input.polygonCoordinates as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
    include: {
      building: { select: { id: true, name: true, code: true } },
      campus: { select: { id: true, name: true, campusKind: true } },
      school: { select: { id: true, name: true, color: true } },
      district: { select: { id: true, name: true } },
    },
  })

  invalidateOrgCache(orgId)

  return NextResponse.json(ok(space), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateSpaceSchema })
