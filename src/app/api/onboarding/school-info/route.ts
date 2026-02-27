/**
 * Onboarding School Info API
 *
 * GET /api/onboarding/school-info — Fetch current org details
 * PATCH /api/onboarding/school-info — Update org school info during onboarding
 *
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { rawPrisma } from '@/lib/db'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { geocodeAddress } from '@/lib/services/geocodingService'

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

export async function GET(req: NextRequest) {
  try {
    await getUserContext(req)
    const orgId = getOrgIdFromRequest(req)

    // Use raw query to include new lat/lng fields
    const rows = await rawPrisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT id, name, slug, website, phone, "physicalAddress", district,
             "gradeRange", "principalName", "principalEmail", "institutionType",
             "studentCount", "staffCount", "logoUrl", latitude, longitude
      FROM "Organization"
      WHERE id = ${orgId}
      LIMIT 1
    `

    const org = rows[0]
    if (!org) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    return NextResponse.json(ok(org))
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    console.error('Get school info error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch school info'), { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await getUserContext(req)
    const orgId = getOrgIdFromRequest(req)

    const body = await req.json()
    const validation = UpdateSchoolInfoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request', validation.error.issues),
        { status: 400 }
      )
    }

    const data = validation.data

    // Auto-geocode the address if it changed
    let geoData: { latitude: number; longitude: number } | null = null
    if (data.physicalAddress) {
      const geo = await geocodeAddress(data.physicalAddress)
      if (geo) {
        geoData = { latitude: geo.lat, longitude: geo.lng }
      }
    }

    // Update standard fields via Prisma
    const updatedOrg = await rawPrisma.organization.update({
      where: { id: orgId },
      data: {
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.physicalAddress !== undefined && { physicalAddress: data.physicalAddress }),
        ...(data.district !== undefined && { district: data.district }),
        ...(data.gradeRange !== undefined && { gradeRange: data.gradeRange }),
        ...(data.principalName !== undefined && { principalName: data.principalName }),
        ...(data.principalEmail !== undefined && { principalEmail: data.principalEmail }),
        ...(data.institutionType !== undefined && { institutionType: data.institutionType }),
        ...(data.studentCount !== undefined && { studentCount: data.studentCount }),
        ...(data.staffCount !== undefined && { staffCount: data.staffCount }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    })

    // Update lat/lng via raw SQL (new fields not yet in Prisma types)
    if (geoData) {
      await rawPrisma.$executeRaw`
        UPDATE "Organization"
        SET latitude = ${geoData.latitude}, longitude = ${geoData.longitude}
        WHERE id = ${orgId}
      `
    }

    return NextResponse.json(ok(updatedOrg))
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    console.error('Update school info error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update school info'), { status: 500 })
  }
}
