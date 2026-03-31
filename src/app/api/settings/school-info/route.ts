import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_PLACES_API_KEY) return null
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', address)
    url.searchParams.set('key', GOOGLE_PLACES_API_KEY)
    const res = await fetch(url.toString())
    const data = await res.json()
    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      return data.results[0].geometry.location
    }
    return null
  } catch (err) {
    logger.warn({ err }, 'Failed to geocode address')
    return null
  }
}

const nullableText = (max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().max(max).nullable().optional()
  )

const SchoolInfoSchema = z.object({
  name: z.string().trim().min(2).max(100),
  institutionType: z.enum(['PUBLIC', 'PRIVATE', 'CHARTER', 'HYBRID']).nullable().optional(),
  gradeLevel: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'GLOBAL', 'MULTI_SCHOOL_CAMPUS']).nullable().optional(),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  physicalAddress: nullableText(400),
  district: nullableText(160),
  website: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().url('Website must be a valid URL (include https://)').max(300).nullable().optional()
  ),
  phone: nullableText(40),
  principalName: nullableText(120),
  principalEmail: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().email('Principal email must be valid').max(255).nullable().optional()
  ),
  principalPhone: nullableText(40),
  headOfSchoolsName: nullableText(120),
  headOfSchoolsEmail: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().email('Head of Schools email must be valid').max(255).nullable().optional()
  ),
  headOfSchoolsPhone: nullableText(40),
  gradeRange: nullableText(80),
  studentCount: z.number().int().min(0).max(1000000).nullable().optional(),
  staffCount: z.number().int().min(0).max(1000000).nullable().optional(),
  logoUrl: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().url('Logo URL must be valid').max(400).nullable().optional()
  ),
  heroImageUrl: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().url('Hero image URL must be valid').max(400).nullable().optional()
  ),
  imagePosition: z.enum(['LEFT', 'RIGHT']).optional(),
})

function toNullable(value?: string | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const GET = withAuth(async ({ orgId }) => {
  const [organization, primaryAdmin, campus] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        institutionType: true,
        gradeLevel: true,
        slug: true,
        physicalAddress: true,
        district: true,
        website: true,
        phone: true,
        principalName: true,
        principalEmail: true,
        principalPhone: true,
        headOfSchoolsName: true,
        headOfSchoolsEmail: true,
        headOfSchoolsPhone: true,
        gradeRange: true,
        studentCount: true,
        staffCount: true,
        logoUrl: true,
        heroImageUrl: true,
        imagePosition: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.findFirst({
      where: {
        organizationId: orgId,
        userRole: {
          slug: { in: ['super-admin', 'admin'] },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        email: true,
        phone: true,
        jobTitle: true,
      },
    }),
    Promise.all([
      prisma.building.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.area.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.room.count({ where: { organizationId: orgId, isActive: true } }),
    ]),
  ])

  if (!organization) {
    return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
  }

  const [buildingCount, areaCount, roomCount] = campus

  return NextResponse.json(
    ok({
      ...organization,
      primaryAdminContact: {
        name: primaryAdmin?.name || null,
        email: primaryAdmin?.email || null,
        phone: primaryAdmin?.phone || null,
        title: primaryAdmin?.jobTitle || null,
      },
      campusSnapshot: {
        buildings: buildingCount,
        areas: areaCount,
        rooms: roomCount,
      },
    })
  )
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<z.infer<typeof SchoolInfoSchema>>(async ({ orgId, body }) => {
  // Geocode address before saving so coordinates are available immediately
  const newAddress = toNullable(body.physicalAddress)
  let geoData: { latitude?: number; longitude?: number } = {}
  if (newAddress) {
    const coords = await geocodeAddress(newAddress)
    if (coords) {
      geoData = { latitude: coords.lat, longitude: coords.lng }
    }
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      name: body.name,
      institutionType: body.institutionType ? body.institutionType : undefined,
      gradeLevel: body.gradeLevel ? body.gradeLevel : undefined,
      slug: body.slug,
      physicalAddress: toNullable(body.physicalAddress),
      district: toNullable(body.district),
      website: toNullable(body.website),
      phone: toNullable(body.phone),
      principalName: toNullable(body.principalName),
      principalEmail: toNullable(body.principalEmail),
      principalPhone: toNullable(body.principalPhone),
      headOfSchoolsName: toNullable(body.headOfSchoolsName),
      headOfSchoolsEmail: toNullable(body.headOfSchoolsEmail),
      headOfSchoolsPhone: toNullable(body.headOfSchoolsPhone),
      gradeRange: toNullable(body.gradeRange),
      studentCount: body.studentCount ?? null,
      staffCount: body.staffCount ?? null,
      logoUrl: toNullable(body.logoUrl),
      heroImageUrl: toNullable(body.heroImageUrl),
      imagePosition: body.imagePosition || 'LEFT',
      ...geoData,
    },
    select: {
      id: true,
      name: true,
      institutionType: true,
      gradeLevel: true,
      slug: true,
      physicalAddress: true,
      district: true,
      website: true,
      phone: true,
      principalName: true,
      principalEmail: true,
      principalPhone: true,
      headOfSchoolsName: true,
      headOfSchoolsEmail: true,
      headOfSchoolsPhone: true,
      gradeRange: true,
      studentCount: true,
      staffCount: true,
      logoUrl: true,
      heroImageUrl: true,
      imagePosition: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: SchoolInfoSchema })
