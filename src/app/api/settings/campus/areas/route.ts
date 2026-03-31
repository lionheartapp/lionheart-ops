import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'

const CreateAreaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  campusId: z.string().min(1, 'Campus is required'),
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

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const includeInactive = searchParams.get('includeInactive') === 'true'
  const buildingId = searchParams.get('buildingId') || undefined
  const campusId = searchParams.get('campusId') || undefined
  const db = prisma as any

  const areas = await db.area.findMany({
    where: {
      organizationId: orgId,
      ...(includeInactive ? {} : { isActive: true }),
      ...(buildingId ? { buildingId } : {}),
      ...(campusId ? { campusId } : {}),
    },
    include: {
      building: {
        select: { id: true, name: true, code: true },
      },
      campus: { select: { id: true, name: true, campusType: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(ok(areas))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const POST = withAuth<z.infer<typeof CreateAreaSchema>>(async ({ orgId, body: input }) => {
  const db = prisma as any

  if (input.buildingId) {
    const building = await db.building.findFirst({
      where: { id: input.buildingId, organizationId: orgId },
      select: { id: true },
    })
    if (!building) {
      return NextResponse.json(fail('BAD_REQUEST', 'Invalid buildingId for this organization'), { status: 400 })
    }
  }

  // Validate campus exists
  const campus = await db.campus.findFirst({
    where: { id: input.campusId, organizationId: orgId, deletedAt: null },
    select: { id: true },
  })
  if (!campus) {
    return NextResponse.json(fail('NOT_FOUND', 'Campus not found'), { status: 404 })
  }

  const area = await db.area.create({
    data: {
      organizationId: orgId,
      campusId: input.campusId,
      name: input.name,
      areaType: input.areaType || 'OTHER',
      buildingId: input.buildingId || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      polygonCoordinates: input.polygonCoordinates ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    },
    include: {
      building: {
        select: { id: true, name: true, code: true },
      },
    },
  })

  return NextResponse.json(ok(area), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateAreaSchema })
