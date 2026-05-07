import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { generateSetupToken, getSetupLink, hashSetupToken } from '@/lib/auth/password-setup'
import { sendWelcomeEmail } from '@/lib/services/emailService'
import { PERMISSIONS } from '@/lib/permissions'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import { audit, getIp } from '@/lib/services/auditService'
import { logger } from '@/lib/logger'
import { safeName } from '@/lib/sanitize'

// CR-010 + LIVE-001: Zod schema with HTML-stripping on free-text user fields.
// Adds an actual email-format check (the previous code only required truthy
// non-empty), bounds on string lengths, enum-validation for status/
// employmentType/campusScope/provisioningMode, and array typing for teamIds.
// teamIds membership in the caller's org is enforced separately at handler
// level.
const InviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  firstName: safeName({ max: 100 }),
  lastName: safeName({ max: 100 }),
  roleId: z.string().min(1, 'roleId is required'),
  teamIds: z.array(z.string().min(1)).max(50).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  schoolId: z.string().min(1).optional().nullable(),
  campusId: z.string().min(1).optional().nullable(),
  employmentType: z
    .enum(['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'VOLUNTEER'])
    .optional()
    .nullable(),
  // Accept legacy schoolScope alias; resolved below.
  campusScope: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).optional().nullable(),
  schoolScope: z.enum(['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).optional().nullable(),
  provisioningMode: z.enum(['ADMIN_CREATE', 'INVITE_ONLY']).optional(),
})

export const GET = withAuth(async ({ orgId, ctx, searchParams }) => {
  const { page, limit, skip } = parsePagination(searchParams)
  const search = searchParams.get('search') || ''
  const roleId = searchParams.get('roleId') || ''
  const teamSlug = searchParams.get('teamSlug') || ''
  const status = searchParams.get('status') || ''
  // Accept both `campusScope` (preferred) and legacy `schoolScope` query params
  const campusScope =
    searchParams.get('campusScope') || searchParams.get('schoolScope') || ''

  const where: Record<string, unknown> = {
    organizationId: orgId,
  }

  // Search by first name, last name, or email
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]
  }

  // Filter by role
  if (roleId) {
    where.roleId = roleId
  }

  // Filter by team (junction table)
  if (teamSlug) {
    where.teams = {
      some: { team: { slug: teamSlug } },
    }
  }

  // Filter by status
  if (status) {
    where.status = status
  }

  // Filter by campus scope (grade-level division)
  if (campusScope) {
    where.campusScope = campusScope
  }

  const userSelect = {
    id: true,
    email: true,
    name: true,
    firstName: true,
    lastName: true,
    avatar: true,
    jobTitle: true,
    campusScope: true,
    campusId: true,
    schoolId: true,
    employmentType: true,
    phone: true,
    status: true,
    createdAt: true,
    campus: {
      select: { id: true, name: true },
    },
    school: {
      select: { id: true, name: true },
    },
    teams: {
      select: {
        team: { select: { id: true, name: true, slug: true } },
      },
    },
    userRole: {
      select: {
        id: true,
        name: true,
        slug: true,
      },
    },
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      skip,
      take: limit,
      orderBy: [
        { status: 'asc' }, // ACTIVE first
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    }),
  ])

  // F-011: removed users.read audit row.
  //
  // The previous implementation wrote an audit log entry on every GET — once
  // per page, once per keystroke in the search box, once per filter change.
  // Real audit signals (role.create, user.invite, etc.) were buried in
  // read-noise and the table grew unbounded.
  //
  // If we want compliance-grade tracking of bulk PII access, the right place
  // is the dedicated CSV export endpoint (/api/settings/export/users), which
  // is already gated by USERS_READ and explicitly downloads the data — that's
  // a meaningful event. Routine list-views of the Members tab are not.
  void audit
  void getIp

  // Backward-compat: emit `schoolScope` alias alongside the new `campusScope`
  const usersWithCompat = users.map((u: Record<string, unknown>) => ({
    ...u,
    schoolScope: u.campusScope,
  }))

  return NextResponse.json(ok(usersWithCompat, paginationMeta(total, { page, limit, skip })))
}, { permission: PERMISSIONS.USERS_READ })

export const POST = withAuth(async ({ req, orgId, ctx }) => {
  const log = logger.child({ route: '/api/settings/users', method: 'POST' })
  const rawBody = await req.json().catch(() => ({}))
  const parsed = InviteUserSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid user invite input', parsed.error.issues),
      { status: 400 }
    )
  }

  const passwordSetupTokenModel = (prisma as unknown as OrgPrismaClient).passwordSetupToken
  const {
    email,
    firstName,
    lastName,
    roleId,
    phone = null,
    jobTitle = null,
    schoolId = null,
    campusId = null,
    employmentType = null,
  } = parsed.data
  const teamIds = parsed.data.teamIds ?? []
  // Accept both `campusScope` (preferred) and legacy `schoolScope` for backward compat.
  // `null` is now the org-wide default (replaces the old 'GLOBAL' enum value).
  const campusScope = parsed.data.campusScope ?? parsed.data.schoolScope ?? null
  const provisioningMode = parsed.data.provisioningMode ?? 'ADMIN_CREATE'

  const existing = await prisma.user.findUnique({
    where: {
      organizationId_email: {
        organizationId: orgId,
        email,
      },
    },
  })
  if (existing) {
    return NextResponse.json(fail('CONFLICT', 'A user with this email already exists'), {
      status: 409,
    })
  }

  const role = await prisma.role.findFirst({
    where: {
      id: roleId,
      organizationId: orgId,
    },
    select: { id: true },
  })
  if (!role) {
    return NextResponse.json(fail('BAD_REQUEST', 'Invalid role for this organization'), {
      status: 400,
    })
  }

  // CR-010: verify every supplied teamId actually belongs to this org. Without
  // this, a caller could attach a new user to teams from another tenant.
  if (teamIds.length > 0) {
    const validTeams = await prisma.team.findMany({
      where: { id: { in: teamIds }, organizationId: orgId },
      select: { id: true },
    })
    if (validTeams.length !== teamIds.length) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'One or more selected teams do not belong to this organization'),
        { status: 400 }
      )
    }
  }

  // Fetch org slug for tenant-aware email links
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { slug: true, name: true },
  })

  const temporaryPassword = randomBytes(24).toString('hex')
  const passwordHash = await hash(temporaryPassword, 10)
  const setupToken = generateSetupToken()
  const setupTokenHash = hashSetupToken(setupToken)
  const setupLink = getSetupLink(setupToken, org.slug)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

  const user = await prisma.user.create({
    data: {
      organizationId: orgId,
      email,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      phone,
      jobTitle,
      schoolId,
      campusId,
      campusScope,
      employmentType,
      passwordHash,
      roleId,
      status: provisioningMode === 'ADMIN_CREATE' ? 'ACTIVE' : 'PENDING',
      ...(teamIds.length > 0
        ? { teams: { create: teamIds.map((teamId: string) => ({ teamId })) } }
        : {}),
    },
    include: {
      teams: {
        select: { team: { select: { id: true, name: true, slug: true } } },
      },
      userRole: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  // Auto-create personal "My Schedule" calendar for the new user
  // organizationId is auto-injected by the org-scoped Prisma extension
  await (prisma as unknown as OrgPrismaClient).calendar.create({
    data: {
      name: 'My Schedule',
      slug: `my-schedule-${user.id.slice(-8)}`,
      calendarType: 'PERSONAL',
      visibility: 'CAMPUS',
      createdById: user.id,
      color: '#6366f1',
    },
  })

  await passwordSetupTokenModel.create({
    data: {
      userId: user.id,
      tokenHash: setupTokenHash,
      expiresAt,
    },
  })

  const emailResult = await sendWelcomeEmail({
    to: user.email,
    firstName: user.firstName || 'there',
    organizationName: org.name || 'your school',
    setupLink,
    expiresAtIso: expiresAt.toISOString(),
    mode: provisioningMode,
  })

  log.info({ userId: user.id, provisioningMode, emailSent: emailResult.sent }, 'Welcome link generated')

  await audit({
    organizationId: orgId,
    userId:         ctx.userId,
    userEmail:      ctx.email,
    action:         'user.invite',
    resourceType:   'User',
    resourceId:     user.id,
    resourceLabel:  user.email,
    changes:        { email, roleId, teamCount: teamIds.length, provisioningMode },
    ipAddress:      getIp(req),
  })

  return NextResponse.json(
    ok({
      user,
      setup: {
        setupLink,
        expiresAt: expiresAt.toISOString(),
        mode: provisioningMode,
        emailSent: emailResult.sent,
        emailReason: emailResult.reason,
      },
    }),
    { status: 201 }
  )
}, { permission: PERMISSIONS.USERS_INVITE })
