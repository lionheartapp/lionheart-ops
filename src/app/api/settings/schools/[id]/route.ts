import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'

const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

const isValidExtension = (value: string) => /^\d{1,6}$/.test(value)

const UpdateSchoolSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  gradeLevel: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).optional(),
  principalName: z.string().trim().max(100).nullable().optional(),
  principalEmail: z.string().email().nullable().optional(),
  principalPhone: z.string().trim().max(20).nullable().optional(),
  principalPhoneExt: z.string().trim().max(20).nullable().optional(),
})

type UpdateSchoolInput = z.infer<typeof UpdateSchoolSchema>

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()
    const input = UpdateSchoolSchema.parse(body)
    const principalPhone = input.principalPhone === undefined || input.principalPhone === null
      ? input.principalPhone
      : input.principalPhone.trim()
    const principalPhoneExt = input.principalPhoneExt === undefined || input.principalPhoneExt === null
      ? input.principalPhoneExt
      : input.principalPhoneExt.trim()

    if (typeof principalPhone === 'string' && principalPhone && !isValidPhone(principalPhone)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Principal phone must be a valid phone number'),
        { status: 400 }
      )
    }

    if (typeof principalPhoneExt === 'string' && principalPhoneExt && !isValidExtension(principalPhoneExt)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Extension must be numeric and up to 6 digits'),
        { status: 400 }
      )
    }

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      // Verify school belongs to organization
      const school = await prisma.school.findUnique({
        where: { id },
      })

      if (!school || school.organizationId !== orgId) {
        return NextResponse.json(fail('NOT_FOUND', 'School not found'), { status: 404 })
      }

      // If name is being updated, check for duplicates
      if (input.name && input.name !== school.name) {
        const existing = await prisma.school.findFirst({
          where: {
            organizationId: orgId,
            name: input.name,
            id: { not: id },
          },
        })

        if (existing) {
          return NextResponse.json(
            fail('CONFLICT', 'A school with this name already exists'),
            { status: 409 }
          )
        }
      }

      const updated = await prisma.school.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.gradeLevel !== undefined && { gradeLevel: input.gradeLevel }),
          ...(input.principalName !== undefined && { principalName: input.principalName }),
          ...(input.principalEmail !== undefined && { principalEmail: input.principalEmail }),
          ...(input.principalPhone !== undefined && { principalPhone }),
          ...(input.principalPhoneExt !== undefined && { principalPhoneExt }),
        },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          principalName: true,
          principalEmail: true,
          principalPhone: true,
          principalPhoneExt: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return NextResponse.json(ok(updated))
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
    console.error('Failed to update school:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update school'), { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      // Verify school belongs to organization
      const school = await prisma.school.findUnique({
        where: { id },
      })

      if (!school || school.organizationId !== orgId) {
        return NextResponse.json(fail('NOT_FOUND', 'School not found'), { status: 404 })
      }

      // Check if school has users assigned to it
      const userCount = await prisma.user.count({
        where: {
          schoolId: id,
        },
      })

      if (userCount > 0) {
        return NextResponse.json(
          fail('CONFLICT', `Cannot delete school with ${userCount} assigned user(s)`),
          { status: 409 }
        )
      }

      await prisma.school.delete({
        where: { id },
      })

      return NextResponse.json(ok({ message: 'School deleted successfully' }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to delete school:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete school'), { status: 500 })
  }
}
