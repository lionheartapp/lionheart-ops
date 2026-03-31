import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const CreateBuildingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(30).optional().nullable(),
  campusId: z.string().min(1, 'Campus is required'),
  schoolId: z.string().optional().nullable(),
  schoolDivision: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'GLOBAL']).optional(),
  buildingType: z.enum(['GENERAL', 'ARTS_CULTURE', 'ATHLETICS', 'ADMINISTRATION', 'SUPPORT_SERVICES']).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
})

export const GET = withAuth(
  async ({ orgId, searchParams }) => {
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const schoolId = searchParams.get('schoolId') || undefined
    const campusId = searchParams.get('campusId') || undefined
    const db = prisma as any

    const buildings = await db.building.findMany({
      where: {
        organizationId: orgId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(schoolId ? { schoolId } : {}),
        ...(campusId ? { campusId } : {}),
      },
      include: {
        school: { select: { id: true, name: true, gradeLevel: true, color: true } },
        campus: { select: { id: true, name: true, campusType: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(ok(buildings))
  },
  { permission: PERMISSIONS.SETTINGS_READ }
)

export const POST = withAuth(
  async ({ orgId, body }) => {
    const db = prisma as any

    // Validate campus exists in this org
    const campus = await db.campus.findFirst({
      where: { id: body.campusId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    })
    if (!campus) {
      return NextResponse.json(fail('NOT_FOUND', 'Campus not found'), { status: 404 })
    }

    // If schoolId provided, validate it belongs to the same campus
    if (body.schoolId) {
      const school = await db.school.findFirst({
        where: { id: body.schoolId, organizationId: orgId, deletedAt: null },
        select: { campusId: true },
      })
      if (school && school.campusId && school.campusId !== body.campusId) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'School does not belong to the specified campus'),
          { status: 400 }
        )
      }
    }

    const building = await db.building.create({
      data: {
        organizationId: orgId,
        campusId: body.campusId,
        name: body.name,
        code: body.code || null,
        schoolId: body.schoolId || null,
        schoolDivision: body.schoolDivision || 'GLOBAL',
        buildingType: body.buildingType || 'GENERAL',
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
      },
      include: {
        school: { select: { id: true, name: true, gradeLevel: true, color: true } },
        campus: { select: { id: true, name: true, campusType: true } },
      },
    })

    return NextResponse.json(ok(building), { status: 201 })
  },
  { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateBuildingSchema }
)
