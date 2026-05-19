import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma, rawPrisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { PERMISSIONS } from '@/lib/permissions'
import { invalidateOrgCache } from '@/lib/cache/settings-cache'
import { geocodeAddress } from '@/lib/services/geocodingService'

/**
 * PATCH /api/settings/campus/buildings/:id
 *
 * Buildings are polymorphic — the parent can be re-pointed between
 * (districtId, schoolId, campusId) but exactly one must always be set.
 * The old BuildingSchool M:N junction and per-building schoolDivision
 * field were dropped in Phase 1b.
 */
const UpdateBuildingSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    code: z.string().trim().min(1).max(30).optional().nullable(),
    districtId: z.string().min(1).optional().nullable(),
    schoolId: z.string().min(1).optional().nullable(),
    campusId: z.string().min(1).optional().nullable(),
    siteId: z.string().min(1).optional().nullable(),
    address: z.string().trim().max(400).optional().nullable(),
    buildingType: z
      .enum(['GENERAL', 'ARTS_CULTURE', 'ATHLETICS', 'ADMINISTRATION', 'SUPPORT_SERVICES'])
      .optional(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
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
  })
  .refine(
    (input) => {
      // Only validate when caller is touching parent fields at all
      const touched = [input.districtId, input.schoolId, input.campusId].some(
        (v) => v !== undefined,
      )
      if (!touched) return true
      const set = [input.districtId, input.schoolId, input.campusId].filter(Boolean).length
      return set === 1
    },
    {
      message: 'When changing the parent, exactly one of districtId, schoolId, or campusId must be set.',
    },
  )

export const GET = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const building = await prisma.building.findFirst({
    where: { id: params.id, organizationId: orgId },
    include: {
      school: { select: { id: true, name: true, color: true } },
      district: { select: { id: true, name: true } },
      campus: { select: { id: true, name: true, campusKind: true } },
      site: { select: { id: true, label: true, address: true } },
    },
  })

  if (!building) {
    return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
  }

  // Auto-geocode if address exists but no coordinates — persist for future loads
  if (!building.latitude && !building.longitude && building.address) {
    const geo = await geocodeAddress(building.address)
    if (geo) {
      await prisma.building.update({
        where: { id: params.id },
        data: { latitude: geo.lat, longitude: geo.lng },
      })
      ;(building as any).latitude = geo.lat
      ;(building as any).longitude = geo.lng
    }
  }

  return NextResponse.json(ok(building))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<unknown, { id: string }>(async ({ req, orgId, params }) => {
  const body = await req.json()
  const input = UpdateBuildingSchema.parse(body)

  const existing = await prisma.building.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true, districtId: true, schoolId: true, campusId: true },
  })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
  }

  // If caller is touching parent fields, null out the untouched ones so we
  // preserve the "exactly one parent" invariant.
  const touchingParent = [input.districtId, input.schoolId, input.campusId].some(
    (v) => v !== undefined,
  )

  const patch: Record<string, unknown> = { ...input }
  if (touchingParent) {
    patch.districtId = input.districtId ?? null
    patch.schoolId = input.schoolId ?? null
    patch.campusId = input.campusId ?? null
  }

  const building = await prisma.building.update({
    where: { id: params.id },
    data: Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    ) as Prisma.BuildingUpdateInput,
    include: {
      school: { select: { id: true, name: true, color: true } },
      district: { select: { id: true, name: true } },
      campus: { select: { id: true, name: true, campusKind: true } },
      site: { select: { id: true, label: true, address: true } },
    },
  })

  invalidateOrgCache(orgId)

  return NextResponse.json(ok(building))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })

export const DELETE = withAuth<unknown, { id: string }>(async ({ orgId, params, searchParams }) => {
  const permanent = searchParams.get('permanent') === 'true'

  const existing = await prisma.building.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
  }

  if (permanent) {
    // Hard delete: use rawPrisma to bypass soft-delete extension.
    // Spaces under this building become orphaned (buildingId → null) rather
    // than being deleted, matching the pre-Phase-1b semantics.
    await rawPrisma.room.deleteMany({ where: { buildingId: params.id, organizationId: orgId } })
    await rawPrisma.space.updateMany({
      where: { buildingId: params.id, organizationId: orgId },
      data: { buildingId: null },
    })
    await rawPrisma.building.delete({ where: { id: params.id } })
    invalidateOrgCache(orgId)
    return NextResponse.json(ok({ id: params.id, deleted: true }))
  } else {
    const building = await prisma.building.update({
      where: { id: params.id },
      data: { isActive: false },
    })
    invalidateOrgCache(orgId)
    return NextResponse.json(ok(building))
  }
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
