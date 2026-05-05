import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'
import { invalidateOrgCache } from '@/lib/cache/settings-cache'
import { safeName } from '@/lib/sanitize'

const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

const isValidExtension = (value: string) => /^\d{1,6}$/.test(value)

const UpdateSchoolSchema = z.object({
  // LIVE-001
  name: safeName({ max: 120 }).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  logoUrl: z.string().nullable().optional(),
  institutionType: z.enum(['PUBLIC', 'PRIVATE', 'CHARTER', 'HYBRID', 'FAITH_BASED']).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  principalName: z.string().trim().max(100).nullable().optional(),
  principalEmail: z.string().email().nullable().optional(),
  principalPhone: z.string().trim().max(20).nullable().optional(),
  principalPhoneExt: z.string().trim().max(20).nullable().optional(),
})

export const PATCH = withAuth<z.infer<typeof UpdateSchoolSchema>, { id: string }>(async ({ orgId, body: input, params }) => {
  const { id } = params
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

  // Verify school belongs to organization
  const school = await prisma.school.findUnique({
    where: { id },
  })

  if (!school || school.organizationId !== orgId) {
    return NextResponse.json(fail('NOT_FOUND', 'School not found'), { status: 404 })
  }

  // If name is being updated, check for duplicates in the same org
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
      ...(input.color !== undefined && { color: input.color }),
      ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
      ...(input.institutionType !== undefined && { institutionType: input.institutionType }),
      ...(input.address !== undefined && { address: input.address }),
      ...(input.principalName !== undefined && { principalName: input.principalName }),
      ...(input.principalEmail !== undefined && { principalEmail: input.principalEmail }),
      ...(input.principalPhone !== undefined && { principalPhone }),
      ...(input.principalPhoneExt !== undefined && { principalPhoneExt }),
    },
    select: {
      id: true,
      name: true,
      color: true,
      logoUrl: true,
      institutionType: true,
      address: true,
      principalName: true,
      principalEmail: true,
      principalPhone: true,
      principalPhoneExt: true,
      campuses: { select: { id: true, name: true, gradeLevel: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  invalidateOrgCache(orgId)

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateSchoolSchema })

export const DELETE = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const { id } = params

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

  invalidateOrgCache(orgId)

  return NextResponse.json(ok({ message: 'School deleted successfully' }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
