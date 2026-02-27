import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
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

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
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
          school: { select: { id: true, name: true, gradeLevel: true } },
          campus: { select: { id: true, name: true, campusType: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })

      return NextResponse.json(ok(buildings))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch buildings'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateBuildingSchema.parse(body)
      const db = prisma as any

      // Validate campus exists in this org
      const campus = await db.campus.findFirst({
        where: { id: input.campusId, organizationId: orgId, deletedAt: null },
        select: { id: true },
      })
      if (!campus) {
        return NextResponse.json(fail('NOT_FOUND', 'Campus not found'), { status: 404 })
      }

      // If schoolId provided, validate it belongs to the same campus
      if (input.schoolId) {
        const school = await db.school.findFirst({
          where: { id: input.schoolId, organizationId: orgId, deletedAt: null },
          select: { campusId: true },
        })
        if (school && school.campusId && school.campusId !== input.campusId) {
          return NextResponse.json(
            fail('VALIDATION_ERROR', 'School does not belong to the specified campus'),
            { status: 400 }
          )
        }
      }

      const building = await db.building.create({
        data: {
          organizationId: orgId,
          campusId: input.campusId,
          name: input.name,
          code: input.code || null,
          schoolId: input.schoolId || null,
          schoolDivision: input.schoolDivision || 'GLOBAL',
          buildingType: input.buildingType || 'GENERAL',
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
        },
        include: {
          school: { select: { id: true, name: true, gradeLevel: true } },
          campus: { select: { id: true, name: true, campusType: true } },
        },
      })

      return NextResponse.json(ok(building), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create building'), { status: 500 })
  }
}
