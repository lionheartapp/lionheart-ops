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
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'

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
    const ctx = await getUserContext(req)
    const orgId = getOrgIdFromRequest(req)

    // Organization is not org-scoped in the extension, so rawPrisma is correct
    const org = await rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        website: true,
        phone: true,
        physicalAddress: true,
        district: true,
        gradeRange: true,
        principalName: true,
        principalEmail: true,
        institutionType: true,
        studentCount: true,
        staffCount: true,
        logoUrl: true,
      },
    })

    if (!org) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    return NextResponse.json(ok(org))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or invalid authorization')) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Missing x-org-id')) {
      return NextResponse.json(fail('FORBIDDEN', 'Missing tenant context'), { status: 403 })
    }
    console.error('Get school info error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch school info'), { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
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

    // Organization is not org-scoped in the extension, so rawPrisma is correct
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

    return NextResponse.json(ok(updatedOrg))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or invalid authorization')) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Missing x-org-id')) {
      return NextResponse.json(fail('FORBIDDEN', 'Missing tenant context'), { status: 403 })
    }
    console.error('Update school info error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update school info'), { status: 500 })
  }
}
