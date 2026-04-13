import { NextResponse } from 'next/server'
import { prisma, rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'
import { getCached, invalidateSettingsCache, settingsCacheKey } from '@/lib/cache/settings-cache'

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
  principalName: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(100).nullable().optional()),
  principalEmail: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().email().nullable().optional()),
  principalPhone: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(20).nullable().optional()),
  principalPhoneExt: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(20).nullable().optional()),
})

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const campusId = searchParams.get('campusId') || undefined

  const cacheKey = settingsCacheKey(orgId, `schools:${campusId || 'all'}`)
  const schools = await getCached(cacheKey, () =>
    prisma.school.findMany({
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

  // Check if school name already exists on this campus
  const existing = await prisma.school.findFirst({
    where: {
      organizationId: orgId,
      campusId: input.campusId,
      name: input.name,
    },
  })

  if (existing) {
    return NextResponse.json(
      fail('CONFLICT', 'A school with this name already exists on this campus'),
      { status: 409 }
    )
  }

  // Remove any soft-deleted school with the same name on this campus so the unique constraint doesn't block
  await rawPrisma.school.deleteMany({
    where: {
      organizationId: orgId,
      campusId: input.campusId,
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

  // Invalidate schools cache for this org (all campus variants)
  invalidateSettingsCache(settingsCacheKey(orgId, `schools:${input.campusId}`))
  invalidateSettingsCache(settingsCacheKey(orgId, 'schools:all'))

  return NextResponse.json(ok(school), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateSchoolSchema })
