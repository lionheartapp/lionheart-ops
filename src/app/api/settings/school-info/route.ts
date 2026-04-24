import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'

/**
 * GET/PATCH /api/settings/school-info
 *
 * NEW ONTOLOGY (Phase 1b):
 *   What used to be "the single school behind the org" now lives on the
 *   `School` model. Organizations can have multiple schools (and multiple
 *   districts / campuses). This endpoint reads the *primary* School record
 *   for the org (the first one, fallback to creating a default) and exposes
 *   a handful of org-level settings plus a campus snapshot.
 *
 *   For multi-school management use the `/api/settings/schools` endpoints.
 */

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
    z.string().max(max).nullable().optional(),
  )

const SchoolInfoSchema = z.object({
  name: z.string().trim().min(2).max(100),
  institutionType: z.enum(['PUBLIC', 'PRIVATE', 'CHARTER', 'HYBRID', 'FAITH_BASED']).nullable().optional(),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  address: nullableText(400),
  website: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().url('Website must be a valid URL (include https://)').max(300).nullable().optional(),
  ),
  phone: nullableText(40),
  principalName: nullableText(120),
  principalEmail: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().email('Principal email must be valid').max(255).nullable().optional(),
  ),
  principalPhone: nullableText(40),
  principalPhoneExt: nullableText(20),
  studentCount: z.number().int().min(0).max(1000000).nullable().optional(),
  staffCount: z.number().int().min(0).max(1000000).nullable().optional(),
  logoUrl: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().url('Logo URL must be valid').max(400).nullable().optional(),
  ),
  heroImageUrl: z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    },
    z.string().url('Hero image URL must be valid').max(400).nullable().optional(),
  ),
  imagePosition: z.enum(['LEFT', 'RIGHT']).optional(),
})

function toNullable(value?: string | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Find (or create) the primary School record for the org.
 * In single-school orgs, this is the one and only School. In multi-school
 * orgs, it's the one created first.
 */
async function getOrCreatePrimarySchool(orgId: string, orgName: string) {
  const existing = await prisma.school.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return existing

  return prisma.school.create({
    data: {
      organizationId: orgId,
      name: orgName,
      institutionType: 'PRIVATE',
    },
  })
}

export const GET = withAuth(async ({ orgId }) => {
  const payload = await cacheOrgWide(
    orgId,
    'school-info:summary',
    async () => {
      const organization = await prisma.organization.findUnique({
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
          heroImageUrl: true,
          imagePosition: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      if (!organization) {
        return null
      }

      const [primaryAdmin, primarySchool, snapshot] = await Promise.all([
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
        getOrCreatePrimarySchool(orgId, organization.name),
        Promise.all([
          prisma.building.count({ where: { organizationId: orgId, isActive: true } }),
          prisma.space.count({ where: { organizationId: orgId, isActive: true } }),
          prisma.room.count({ where: { organizationId: orgId, isActive: true } }),
        ]),
      ])

      const [buildingCount, spaceCount, roomCount] = snapshot

      return {
        ...organization,
        // Surface the primary School's fields as the canonical school info
        school: {
          id: primarySchool.id,
          name: primarySchool.name,
          slug: primarySchool.slug,
          institutionType: primarySchool.institutionType,
          address: primarySchool.address,
          latitude: primarySchool.latitude,
          longitude: primarySchool.longitude,
          principalName: primarySchool.principalName,
          principalEmail: primarySchool.principalEmail,
          principalPhone: primarySchool.principalPhone,
          principalPhoneExt: primarySchool.principalPhoneExt,
          logoUrl: primarySchool.logoUrl,
          color: primarySchool.color,
        },
        primaryAdminContact: {
          name: primaryAdmin?.name || null,
          email: primaryAdmin?.email || null,
          phone: primaryAdmin?.phone || null,
          title: primaryAdmin?.jobTitle || null,
        },
        campusSnapshot: {
          buildings: buildingCount,
          spaces: spaceCount,
          rooms: roomCount,
        },
      }
    }
  )

  if (!payload) {
    return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
  }

  return NextResponse.json(ok(payload))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<z.infer<typeof SchoolInfoSchema>>(async ({ orgId, body }) => {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  })
  if (!org) {
    return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
  }

  const primarySchool = await getOrCreatePrimarySchool(orgId, org.name)

  // Geocode address before saving so coordinates are available immediately
  const newAddress = toNullable(body.address)
  let geoData: { latitude?: number | null; longitude?: number | null } = {}
  if (newAddress) {
    const coords = await geocodeAddress(newAddress)
    if (coords) {
      geoData = { latitude: coords.lat, longitude: coords.lng }
    }
  }

  // Update org-level fields that still live on Organization
  const orgPatch: Record<string, unknown> = {
    name: body.name,
  }
  if (body.slug !== undefined) orgPatch.slug = body.slug
  if (body.website !== undefined) orgPatch.website = toNullable(body.website)
  if (body.phone !== undefined) orgPatch.phone = toNullable(body.phone)
  if (body.studentCount !== undefined) orgPatch.studentCount = body.studentCount ?? null
  if (body.staffCount !== undefined) orgPatch.staffCount = body.staffCount ?? null
  if (body.logoUrl !== undefined) orgPatch.logoUrl = toNullable(body.logoUrl)
  if (body.heroImageUrl !== undefined) orgPatch.heroImageUrl = toNullable(body.heroImageUrl)
  if (body.imagePosition !== undefined) orgPatch.imagePosition = body.imagePosition

  // School-level fields (institutionType, address, principal...) now live on School
  const schoolPatch: Record<string, unknown> = {
    name: body.name,
  }
  if (body.institutionType !== undefined && body.institutionType !== null) {
    schoolPatch.institutionType = body.institutionType
  }
  if (body.address !== undefined) schoolPatch.address = toNullable(body.address)
  if (body.principalName !== undefined) schoolPatch.principalName = toNullable(body.principalName)
  if (body.principalEmail !== undefined) schoolPatch.principalEmail = toNullable(body.principalEmail)
  if (body.principalPhone !== undefined) schoolPatch.principalPhone = toNullable(body.principalPhone)
  if (body.principalPhoneExt !== undefined) {
    schoolPatch.principalPhoneExt = toNullable(body.principalPhoneExt)
  }
  if (body.logoUrl !== undefined) schoolPatch.logoUrl = toNullable(body.logoUrl)
  Object.assign(schoolPatch, geoData)

  const [updatedOrg, updatedSchool] = await Promise.all([
    prisma.organization.update({
      where: { id: orgId },
      data: orgPatch,
      select: {
        id: true,
        name: true,
        slug: true,
        website: true,
        phone: true,
        studentCount: true,
        staffCount: true,
        logoUrl: true,
        heroImageUrl: true,
        imagePosition: true,
        updatedAt: true,
      },
    }),
    prisma.school.update({
      where: { id: primarySchool.id },
      data: schoolPatch,
    }),
  ])

  // School-info touches org name/slug/logo (surfaced across the whole app) and
  // the primary School record, so blast the whole org cache rather than trying
  // to enumerate every dependent bucket.
  invalidateOrgCache(orgId)

  return NextResponse.json(
    ok({
      ...updatedOrg,
      school: {
        id: updatedSchool.id,
        name: updatedSchool.name,
        slug: updatedSchool.slug,
        institutionType: updatedSchool.institutionType,
        address: updatedSchool.address,
        latitude: updatedSchool.latitude,
        longitude: updatedSchool.longitude,
        principalName: updatedSchool.principalName,
        principalEmail: updatedSchool.principalEmail,
        principalPhone: updatedSchool.principalPhone,
        principalPhoneExt: updatedSchool.principalPhoneExt,
        logoUrl: updatedSchool.logoUrl,
        color: updatedSchool.color,
      },
    }),
  )
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: SchoolInfoSchema })
