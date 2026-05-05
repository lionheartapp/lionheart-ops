import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { safeName } from '@/lib/sanitize'

// CR-007: Zod schemas for both query and body — replaces hand-rolled validation.
const SearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
})

const PrincipalCreateSchema = z.object({
  // LIVE-001 + CR-007: HTML-strip + length-bound the principal name.
  name: safeName({ max: 120 }),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => !v || isValidPhone(v), 'Principal phone must be a valid phone number')
    .optional()
    .nullable(),
  phoneExt: z
    .string()
    .trim()
    .max(8)
    .refine((v) => !v || isValidExtension(v), 'Extension must be numeric and up to 6 digits')
    .optional()
    .nullable(),
})

const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

const isValidExtension = (value: string) => /^\d{1,6}$/.test(value)

const normalizeNameToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const splitPrincipalName = (value: string) => {
  const cleaned = value.trim().replace(/\s+/g, ' ')
  const parts = cleaned.split(' ').filter(Boolean)
  const firstName = parts[0] || ''
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName
  return { firstName, lastName }
}

const extractDomainFromUrl = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`)
    return parsed.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

const buildPrincipalEmailLocalPart = (firstName: string, lastName: string) => {
  const firstInitial = normalizeNameToken(firstName).charAt(0) || 'p'
  const normalizedLastName = normalizeNameToken(lastName)
  const fallbackLastName = normalizeNameToken(firstName) || 'principal'
  return `${firstInitial}${normalizedLastName || fallbackLastName}`
}

const toPrincipalResponse = (user: {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  phone: string | null
  jobTitle: string | null
  avatar: string | null
}) => ({
  id: user.id,
  name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
  email: user.email,
  phone: user.phone,
  jobTitle: user.jobTitle || '',
  avatar: user.avatar,
})

// GET - Search for principals by name
//
// CR-006: tightened from SETTINGS_READ (granted to MEMBER) to USERS_READ (admin
// only). The previous gate let any active member of the org scrape names,
// emails, phones, and job titles for up to 15 users at a time by typing a
// single character. Principal lookup is an admin task.
export const GET = withAuth(async ({ orgId, searchParams }) => {
  const parsed = SearchSchema.safeParse({ q: searchParams.get('q') ?? undefined })
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid search query', parsed.error.issues),
      { status: 400 }
    )
  }

  const query = (parsed.data.q || '').trim()
  if (!query) {
    return NextResponse.json(ok([]))
  }

  const queryTokens = query.split(/\s+/).map((token) => token.trim()).filter(Boolean)

  const users = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      AND: queryTokens.map((token) => ({
        OR: [
          { firstName: { contains: token, mode: 'insensitive' } },
          { lastName: { contains: token, mode: 'insensitive' } },
          { name: { contains: token, mode: 'insensitive' } },
          { email: { contains: token, mode: 'insensitive' } },
        ],
      })),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      jobTitle: true,
      avatar: true,
    },
    orderBy: [
      { firstName: 'asc' },
      { lastName: 'asc' },
    ],
    take: 15,
  })

  return NextResponse.json(ok(users.map(toPrincipalResponse)))
}, { permission: PERMISSIONS.USERS_READ })

// POST - Create a new principal (user)
//
// CR-005: principals are reference-only User rows — they have an auto-generated
// email (often pointing to a non-existent inbox) and an empty passwordHash so
// they cannot log in. We mark them as PENDING (not ACTIVE) so they don't count
// as billable active users and don't appear in active-user dashboards. An admin
// can later promote them via the canonical /api/settings/users invite flow.
//
// CR-007: input validation moved to Zod (see PrincipalCreateSchema above).
//
// CR-008: the role assigned to the principal is now resolved by slug ("member")
// rather than picking the first row returned by findMany — which was often the
// super-admin role since system roles seed first.
export const POST = withAuth(async ({ req, orgId }) => {
  const rawBody = await req.json().catch(() => ({}))
  const parsed = PrincipalCreateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid principal input', parsed.error.issues),
      { status: 400 }
    )
  }

  const principalName = parsed.data.name.replace(/\s+/g, ' ')
  const phone = parsed.data.phone || null
  // phoneExt is currently parsed but not persisted — preserved for future use.
  const _phoneExt = parsed.data.phoneExt || null
  void _phoneExt

  const { firstName, lastName } = splitPrincipalName(principalName)

  const [organization, existingUserForDomain] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { slug: true, website: true },
    }),
    prisma.user.findFirst({
      where: {
        organizationId: orgId,
        email: {
          not: {
            endsWith: '@temp.local',
          },
        },
      },
      select: { email: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const websiteDomain = extractDomainFromUrl(organization?.website)
  const existingEmailDomain = existingUserForDomain?.email.split('@')[1]?.toLowerCase() || null
  const fallbackDomain = `${(organization?.slug || 'school').toLowerCase()}.com`
  const emailDomain = websiteDomain || existingEmailDomain || fallbackDomain

  const baseLocalPart = buildPrincipalEmailLocalPart(firstName, lastName)
  let email = `${baseLocalPart}@${emailDomain}`
  let suffix = 2

  while (true) {
    const emailExists = await prisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId: orgId,
          email,
        },
      },
      select: { id: true },
    })

    if (!emailExists) break
    email = `${baseLocalPart}${suffix}@${emailDomain}`
    suffix += 1
  }

  // CR-008: resolve a specific safe role by slug. Falling back to "the first
  // role we found" (the previous behavior) frequently picked the super-admin
  // role, since system roles are seeded first. Prefer the standard "member"
  // role; if it doesn't exist, fall back to any non-system role; if none of
  // those exist either, fail clearly rather than silently escalating.
  const memberRole =
    (await prisma.role.findFirst({
      where: { organizationId: orgId, slug: 'member' },
      select: { id: true },
    })) ||
    (await prisma.role.findFirst({
      where: { organizationId: orgId, isSystem: false },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }))

  if (!memberRole) {
    return NextResponse.json(
      fail(
        'BAD_REQUEST',
        'Cannot create principal: no safe default role found in this organization. Create a "member" role first.'
      ),
      { status: 400 }
    )
  }
  const roleId = memberRole.id

  // CR-005: create the principal as a PENDING reference-only stub. Empty
  // passwordHash blocks password-based login (already enforced by the login
  // route). Status PENDING keeps them out of active-user counts and dashboards
  // until an admin formally invites them via /api/settings/users.
  const user = await prisma.user.create({
    data: {
      organizationId: orgId,
      email,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      phone: phone || null,
      jobTitle: 'Principal',
      passwordHash: '', // Will need to be set later
      roleId,
      status: 'PENDING',
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      jobTitle: true,
      avatar: true,
    },
  })

  return NextResponse.json(ok(toPrincipalResponse(user)), { status: 201 })
}, { permission: PERMISSIONS.USERS_INVITE })
