import { NextResponse } from 'next/server'
import { prisma, rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'
import { getCached, invalidateSettingsCache, settingsCacheKey } from '@/lib/cache/settings-cache'

const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

const isValidExtension = (value: string) => /^\d{1,6}$/.test(value)

const CreateSchoolSchema = z.object({
  name: z.string().trim().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  principalName: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(100).nullable().optional()),
  principalEmail: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().email().nullable().optional()),
  principalPhone: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(20).nullable().optional()),
  principalPhoneExt: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(20).nullable().optional()),
})

export const GET = withAuth(async ({ orgId }) => {
  const cacheKey = settingsCacheKey(orgId, 'schools:all')
  const schools = await getCached(cacheKey, () =>
    prisma.school.findMany({
      where: {
        organizationId: orgId,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        principalName: true,
        principalEmail: true,
        principalPhone: true,
        principalPhoneExt: true,
        campuses: { select: { id: true, name: true, gradeLevel: true } },
        createdAt: true,
        updatedAt: true,
      },
    })
  )

  return NextResponse.json(ok(schools))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const POST = withAuth<z.infer<typeof CreateSchoolSchema>>(async ({ orgId, body: input }) => {
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

  // Check if school name already exists in this org
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

  const school = await prisma.school.create({
    data: {
      organizationId: orgId,
      name: input.name,
      color: input.color || '#3b82f6',
      principalName: input.principalName || null,
      principalEmail: input.principalEmail || null,
      principalPhone: principalPhone || null,
      principalPhoneExt: principalPhoneExt || null,
    },
    select: {
      id: true,
      name: true,
      color: true,
      principalName: true,
      principalEmail: true,
      principalPhone: true,
      principalPhoneExt: true,
      campuses: { select: { id: true, name: true, gradeLevel: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  // Invalidate schools cache for this org
  invalidateSettingsCache(settingsCacheKey(orgId, 'schools:all'))

  return NextResponse.json(ok(school), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateSchoolSchema })
