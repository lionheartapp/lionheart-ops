import { NextRequest, NextResponse } from 'next/server'
import { prisma, rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'

const GRADE_DEFAULTS: Record<string, string> = {
  ELEMENTARY: '#a855f7',
  MIDDLE_SCHOOL: '#14b8a6',
  HIGH_SCHOOL: '#ef4444',
}

const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

const isValidExtension = (value: string) => /^\d{1,6}$/.test(value)

const CreateSchoolSchema = z.object({
  name: z.string().trim().min(1).max(120),
  campusId: z.string().min(1, 'Campus is required'),
  gradeLevel: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  principalName: z.string().trim().max(100).optional().nullable(),
  principalEmail: z.string().email().optional().nullable(),
  principalPhone: z.string().trim().max(20).optional().nullable(),
  principalPhoneExt: z.string().trim().max(20).optional().nullable(),
})

type CreateSchoolInput = z.infer<typeof CreateSchoolSchema>

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const campusId = searchParams.get('campusId') || undefined

      const schools = await prisma.school.findMany({
        where: {
          organizationId: orgId,
          ...(campusId ? { campusId } : {}),
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          campusId: true,
          name: true,
          gradeLevel: true,
          color: true,
          principalName: true,
          principalEmail: true,
          principalPhone: true,
          principalPhoneExt: true,
          campus: { select: { id: true, name: true, campusType: true } },
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json(ok(schools))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch schools:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch schools'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()
    const input = CreateSchoolSchema.parse(body)
    const principalPhone = (input.principalPhone || '').trim()
    const principalPhoneExt = (input.principalPhoneExt || '').trim()

    if (principalPhone && !isValidPhone(principalPhone)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Principal phone must be a valid phone number'),
        { status: 400 }
      )
    }

    if (principalPhoneExt && !isValidExtension(principalPhoneExt)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Extension must be numeric and up to 6 digits'),
        { status: 400 }
      )
    }

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      // Check if school name already exists for this organization
      const existing = await prisma.school.findFirst({
        where: {
          organizationId: orgId,
          name: input.name,
        },
      })

      if (existing) {
        return NextResponse.json(
          fail('CONFLICT', 'A school with this name already exists'),
          { status: 409 }
        )
      }

      // Remove any soft-deleted school with the same name so the unique constraint doesn't block
      await rawPrisma.school.deleteMany({
        where: {
          organizationId: orgId,
          name: input.name,
          deletedAt: { not: null },
        },
      })

      // Validate campus exists in this org
      const campus = await prisma.campus.findFirst({
        where: { id: input.campusId },
        select: { id: true },
      })
      if (!campus) {
        return NextResponse.json(
          fail('NOT_FOUND', 'Campus not found'),
          { status: 404 }
        )
      }

      const school = await prisma.school.create({
        data: {
          organizationId: orgId,
          campusId: input.campusId,
          name: input.name,
          gradeLevel: input.gradeLevel,
          color: input.color || GRADE_DEFAULTS[input.gradeLevel] || '#3b82f6',
          principalName: input.principalName || null,
          principalEmail: input.principalEmail || null,
          principalPhone: principalPhone || null,
          principalPhoneExt: principalPhoneExt || null,
        },
        select: {
          id: true,
          campusId: true,
          name: true,
          gradeLevel: true,
          color: true,
          principalName: true,
          principalEmail: true,
          principalPhone: true,
          principalPhoneExt: true,
          campus: { select: { id: true, name: true, campusType: true } },
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json(ok(school), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid school data', error.issues),
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to create school:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create school'), { status: 500 })
  }
}
