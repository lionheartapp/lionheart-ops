import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { invalidateOrgCache } from '@/lib/cache/settings-cache'

/**
 * POST /api/settings/campus/buildings
 *
 * Creates a Building. Buildings are polymorphic — exactly one of
 * (districtId, schoolId, campusId) must be provided. We default to the campus
 * parent when `campusId` is supplied because that matches the existing UI flow,
 * but accept any of the three parent types.
 *
 * The old M:N BuildingSchool junction (`schoolLinks`) and per-building
 * `schoolDivision` field were dropped in Phase 1b. Use the single parent FK
 * plus `buildingType` for scoping.
 */
const CreateBuildingSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().min(1).max(30).optional().nullable(),
    // Polymorphic parent — exactly one of these must be set.
    districtId: z.string().min(1).optional().nullable(),
    schoolId: z.string().min(1).optional().nullable(),
    campusId: z.string().min(1).optional().nullable(),
    // Optional physical-address pin
    siteId: z.string().min(1).optional().nullable(),
    buildingType: z
      .enum(['GENERAL', 'ARTS_CULTURE', 'ATHLETICS', 'ADMINISTRATION', 'SUPPORT_SERVICES'])
      .optional(),
    address: z.string().trim().max(400).optional().nullable(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
  })
  .refine(
    (input) => {
      const parents = [input.districtId, input.schoolId, input.campusId].filter(Boolean).length
      return parents === 1
    },
    { message: 'Exactly one of districtId, schoolId, or campusId is required.' },
  )

export const GET = withAuth(
  async ({ orgId, searchParams }) => {
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const schoolId = searchParams.get('schoolId') || undefined
    const campusId = searchParams.get('campusId') || undefined
    const districtId = searchParams.get('districtId') || undefined

    const buildings = await prisma.building.findMany({
      where: {
        organizationId: orgId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(schoolId ? { schoolId } : {}),
        ...(campusId ? { campusId } : {}),
        ...(districtId ? { districtId } : {}),
      },
      include: {
        school: { select: { id: true, name: true, color: true } },
        district: { select: { id: true, name: true } },
        campus: { select: { id: true, name: true, campusKind: true } },
        site: { select: { id: true, label: true, address: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(ok(buildings))
  },
  { permission: PERMISSIONS.SETTINGS_READ }
)

export const POST = withAuth(
  async ({ orgId, body }) => {
    // Validate parent(s)
    if (body.campusId) {
      const campus = await prisma.campus.findFirst({
        where: { id: body.campusId, organizationId: orgId, deletedAt: null },
        select: { id: true, schoolId: true },
      })
      if (!campus) {
        return NextResponse.json(fail('NOT_FOUND', 'Campus not found'), { status: 404 })
      }
    }
    if (body.schoolId) {
      const school = await prisma.school.findFirst({
        where: { id: body.schoolId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      })
      if (!school) {
        return NextResponse.json(fail('NOT_FOUND', 'School not found'), { status: 404 })
      }
    }
    if (body.districtId) {
      const district = await prisma.district.findFirst({
        where: { id: body.districtId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      })
      if (!district) {
        return NextResponse.json(fail('NOT_FOUND', 'District not found'), { status: 404 })
      }
    }

    const building = await prisma.building.create({
      data: {
        organizationId: orgId,
        districtId: body.districtId || null,
        schoolId: body.schoolId || null,
        campusId: body.campusId || null,
        siteId: body.siteId || null,
        name: body.name,
        code: body.code || null,
        address: body.address || null,
        buildingType: body.buildingType || 'GENERAL',
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
      },
      include: {
        school: { select: { id: true, name: true, color: true } },
        district: { select: { id: true, name: true } },
        campus: { select: { id: true, name: true, campusKind: true } },
        site: { select: { id: true, label: true, address: true } },
      },
    })

    invalidateOrgCache(orgId)

    return NextResponse.json(ok(building), { status: 201 })
  },
  { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateBuildingSchema }
)
