import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'

const CreateSchoolSchema = z.object({
  name: z.string().trim().min(1).max(120),
  gradeLevel: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']),
  principalTitle: z.string().trim().max(100).optional().nullable(),
  principalName: z.string().trim().max(100).optional().nullable(),
  principalEmail: z.string().email().optional().nullable(),
  principalPhone: z.string().trim().max(20).optional().nullable(),
})

type CreateSchoolInput = z.infer<typeof CreateSchoolSchema>

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const schools = await prisma.school.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          principalTitle: true,
          principalName: true,
          principalEmail: true,
          principalPhone: true,
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

      const school = await prisma.school.create({
        data: {
          organizationId: orgId,
          name: input.name,
          gradeLevel: input.gradeLevel,
          principalTitle: input.principalTitle || null,
          principalName: input.principalName || null,
          principalEmail: input.principalEmail || null,
          principalPhone: input.principalPhone || null,
        },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          principalTitle: true,
          principalName: true,
          principalEmail: true,
          principalPhone: true,
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
