import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { hash } from 'bcryptjs'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { generateSetupToken, getSetupLink, hashSetupToken } from '@/lib/auth/password-setup'
import { sendWelcomeEmail } from '@/lib/services/emailService'
import { PERMISSIONS } from '@/lib/permissions'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import { audit, getIp } from '@/lib/services/auditService'
import { logger } from '@/lib/logger'

export const GET = withAuth(async ({ orgId, ctx, searchParams }) => {
  const { page, limit, skip } = parsePagination(searchParams)
  const search = searchParams.get('search') || ''
  const roleId = searchParams.get('roleId') || ''
  const teamSlug = searchParams.get('teamSlug') || ''
  const status = searchParams.get('status') || ''
  const schoolScope = searchParams.get('schoolScope') || ''

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

  // Filter by school scope
  if (schoolScope) {
    where.schoolScope = schoolScope
  }

  const userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    avatar: true,
    jobTitle: true,
    schoolScope: true,
    employmentType: true,
    phone: true,
    status: true,
    createdAt: true,
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

  // Compliance: log bulk PII access
  void audit({
    organizationId: orgId,
    userId: ctx.userId,
    userEmail: ctx.email,
    action: 'users.read',
    resourceType: 'User',
    changes: { count: users.length, page, search: search || undefined, filters: { roleId, teamSlug, status, schoolScope } },
  })

  return NextResponse.json(ok(users, paginationMeta(total, { page, limit, skip })))
}, { permission: PERMISSIONS.USERS_READ })

export const POST = withAuth(async ({ req, orgId, ctx }) => {
  const log = logger.child({ route: '/api/settings/users', method: 'POST' })
  const body = await req.json()

  const passwordSetupTokenModel = (prisma as unknown as OrgPrismaClient).passwordSetupToken
  const email = String(body.email || '').trim().toLowerCase()
  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const roleId = body.roleId ? String(body.roleId) : null
  const teamIds = Array.isArray(body.teamIds) ? body.teamIds.map(String) : []
  const phone = body.phone ? String(body.phone).trim() : null
  const jobTitle = body.jobTitle ? String(body.jobTitle).trim() : null
  const rawEmploymentType = body.employmentType ? String(body.employmentType) : null
  const allowedEmploymentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'VOLUNTEER'] as const
  const employmentType = allowedEmploymentTypes.includes(rawEmploymentType as (typeof allowedEmploymentTypes)[number])
    ? (rawEmploymentType as (typeof allowedEmploymentTypes)[number])
    : null
  const rawSchoolScope = body.schoolScope ? String(body.schoolScope) : null
  const allowedSchoolScopes = ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'GLOBAL'] as const
  const schoolScope = allowedSchoolScopes.includes(rawSchoolScope as (typeof allowedSchoolScopes)[number])
    ? (rawSchoolScope as (typeof allowedSchoolScopes)[number])
    : 'GLOBAL'
  const provisioningMode = body.provisioningMode === 'INVITE_ONLY' ? 'INVITE_ONLY' : 'ADMIN_CREATE'

  if (!email || !firstName || !lastName || !roleId) {
    return NextResponse.json(
      fail('BAD_REQUEST', 'firstName, lastName, email, and roleId are required'),
      { status: 400 }
    )
  }

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
      schoolScope,
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
