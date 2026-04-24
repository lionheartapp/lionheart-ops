/**
 * Onboarding School Info API
 *
 * GET /api/onboarding/school-info — Fetch current org details
 * PATCH /api/onboarding/school-info — Update org school info during onboarding
 *
 * Requires authentication.
 *
 * Phase 1c ontology inversion notes:
 *   • `physicalAddress`, `latitude`, `longitude`, `principalName`,
 *     `principalEmail`, `institutionType` moved off Organization onto School
 *     (per-institution). We read/write those on the primary (first-sorted)
 *     School for backward compat with the existing onboarding UI contract.
 *   • `district` is the name of the District record; when it changes we
 *     upsert the org's default District.
 *   • `gradeRange` was a free-text field on Organization. It has no stable
 *     home post-inversion (grade level is now per-Campus and enum-typed),
 *     so we accept it in the payload for contract stability but no longer
 *     persist it. This is intentional — the onboarding UI should be
 *     updated in a later pass to drop the field.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { rawPrisma } from '@/lib/db'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { geocodeAddress } from '@/lib/services/geocodingService'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { logger } from '@/lib/logger'

const UpdateSchoolInfoSchema = z.object({
  phone: z.string().max(40).nullable().optional(),
  physicalAddress: z.string().max(400).nullable().optional(),
  district: z.string().max(160).nullable().optional(),
  gradeRange: z.string().max(80).nullable().optional(),
  principalName: z.string().max(120).nullable().optional(),
  principalEmail: z.string().email().max(255).nullable().optional(),
  institutionType: z.enum(['PUBLIC', 'PRIVATE', 'CHARTER', 'HYBRID']).optional(),
  studentCount: z.number().int().min(0).max(1000000).nullable().optional(),
  staffCount: z.number().int().min(0).max(1000000).nullable().optional(),
})

/**
 * Fetch the primary (first-sorted, non-deleted) School for an org.
 * Returns `null` if the org has no School yet (pre-onboarding).
 */
async function getPrimarySchool(orgId: string) {
  return rawPrisma.school.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      address: true,
      latitude: true,
      longitude: true,
      principalName: true,
      principalEmail: true,
      institutionType: true,
    },
  })
}

/**
 * Fetch the default (or first-sorted) District for an org, if any.
 */
async function getPrimaryDistrict(orgId: string) {
  return rawPrisma.district.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true },
  })
}

export async function GET(req: NextRequest) {
  try {
    await getUserContext(req)
    const orgId = getOrgIdFromRequest(req)

    const payload = await cacheOrgWide(
      orgId,
      'onboarding-school-info:summary',
      async () => {
        const org = await rawPrisma.organization.findUnique({
          where: { id: orgId },
          select: {
            id: true,
            name: true,
            slug: true,
            website: true,
            phone: true,
            studentCount: true,
            staffCount: true,
            logoUrl: true,
          },
        })

        if (!org) return null

        const [primarySchool, primaryDistrict] = await Promise.all([
          getPrimarySchool(orgId),
          getPrimaryDistrict(orgId),
        ])

        return {
          ...org,
          physicalAddress: primarySchool?.address ?? null,
          latitude: primarySchool?.latitude ?? null,
          longitude: primarySchool?.longitude ?? null,
          principalName: primarySchool?.principalName ?? null,
          principalEmail: primarySchool?.principalEmail ?? null,
          institutionType: primarySchool?.institutionType ?? null,
          district: primaryDistrict?.name ?? null,
          // Legacy — no longer persisted. See file header.
          gradeRange: null as string | null,
        }
      }
    )

    if (!payload) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    return NextResponse.json(ok(payload))
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    logger.error({ error: String(error) }, 'Get school info error')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch school info'), { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    const orgId = getOrgIdFromRequest(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    const body = await req.json()
    const validation = UpdateSchoolInfoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request', validation.error.issues),
        { status: 400 }
      )
    }

    const data = validation.data

    // Auto-geocode the address if it changed. The result is persisted on the
    // primary School (post-inversion) rather than Organization.
    let geoData: { latitude: number; longitude: number } | null = null
    if (data.physicalAddress) {
      const geo = await geocodeAddress(data.physicalAddress)
      if (geo) {
        geoData = { latitude: geo.lat, longitude: geo.lng }
      }
    }

    // Bucket 1 — Organization-level fields that survived the inversion.
    const orgData: Record<string, unknown> = {}
    if (data.phone !== undefined) orgData.phone = data.phone
    if (data.studentCount !== undefined) orgData.studentCount = data.studentCount
    if (data.staffCount !== undefined) orgData.staffCount = data.staffCount

    // Bucket 2 — primary School fields (address, geo, principal, institutionType).
    const schoolData: Record<string, unknown> = {}
    if (data.physicalAddress !== undefined) schoolData.address = data.physicalAddress
    if (data.principalName !== undefined) schoolData.principalName = data.principalName
    if (data.principalEmail !== undefined) schoolData.principalEmail = data.principalEmail
    if (data.institutionType !== undefined) schoolData.institutionType = data.institutionType
    if (geoData) {
      schoolData.latitude = geoData.latitude
      schoolData.longitude = geoData.longitude
    }

    // Perform updates. Each bucket is only touched if it has changes.
    if (Object.keys(orgData).length > 0) {
      await rawPrisma.organization.update({
        where: { id: orgId },
        data: orgData,
      })
    }

    if (Object.keys(schoolData).length > 0) {
      const primarySchool = await rawPrisma.school.findFirst({
        where: { organizationId: orgId, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      })

      if (primarySchool) {
        await rawPrisma.school.update({
          where: { id: primarySchool.id },
          data: schoolData,
        })
      } else {
        // No School yet — create one so onboarding progress isn't lost.
        // Name defaults to the Organization name; the user can rename in the
        // Schools settings tab later.
        const org = await rawPrisma.organization.findUnique({
          where: { id: orgId },
          select: { name: true },
        })
        await rawPrisma.school.create({
          data: {
            organizationId: orgId,
            name: org?.name ?? 'Main School',
            sortOrder: 0,
            ...schoolData,
          },
        })
      }
    }

    // Bucket 3 — District name (upsert the default District).
    if (data.district !== undefined) {
      const existingDefault = await rawPrisma.district.findFirst({
        where: { organizationId: orgId, isDefault: true, deletedAt: null },
        select: { id: true },
      })

      if (data.district === null || data.district === '') {
        // Clear the default district's name? We don't delete — just leave
        // the existing record alone. If there's no existing default we
        // simply do nothing. This preserves downstream references.
      } else if (existingDefault) {
        await rawPrisma.district.update({
          where: { id: existingDefault.id },
          data: { name: data.district },
        })
      } else {
        await rawPrisma.district.create({
          data: {
            organizationId: orgId,
            name: data.district,
            isDefault: true,
            sortOrder: 0,
          },
        })
      }
    }

    // `gradeRange` is accepted but no longer persisted — see file header.

    // Blast org-level caches — onboarding touches org name/slug, primary
    // School, and default District, all of which are read across the app.
    invalidateOrgCache(orgId)

    // Re-fetch the flattened org snapshot for the response so callers get
    // the canonical shape back.
    const updatedOrg = await rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true },
    })

    return NextResponse.json(ok(updatedOrg))
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && (error.message.includes('Insufficient permissions') || error.message.includes('Permission denied'))) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Update school info error')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update school info'), { status: 500 })
  }
}
