import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { hash } from 'bcryptjs'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { generateSetupToken, getSetupLink, hashSetupToken } from '@/lib/auth/password-setup'
import { sendWelcomeEmail } from '@/lib/services/emailService'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    // Check permission to view users
    await assertCan(userContext.userId, PERMISSIONS.USERS_READ)

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const roleId = searchParams.get('roleId') || ''
    const teamSlug = searchParams.get('teamSlug') || ''
    const status = searchParams.get('status') || ''
    const schoolScope = searchParams.get('schoolScope') || ''

    return await runWithOrgContext(orgId, async () => {
      const where: any = {
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

      // Filter by team
      if (teamSlug) {
        where.teamIds = {
          has: teamSlug,
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

      const users = await prisma.user.findMany({
        where,
        select: {
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
          teamIds: true,
          createdAt: true,
          userRole: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: [
          { status: 'asc' }, // ACTIVE first
          { lastName: 'asc' },
          { firstName: 'asc' },
        ],
      })

      return NextResponse.json(ok(users))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch users:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to fetch users'),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    // Check permission to invite users
    await assertCan(userContext.userId, PERMISSIONS.USERS_INVITE)

    return await runWithOrgContext(orgId, async () => {
      const passwordSetupTokenModel = (prisma as any).passwordSetupToken
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

      const temporaryPassword = randomBytes(24).toString('hex')
      const passwordHash = await hash(temporaryPassword, 10)
      const setupToken = generateSetupToken()
      const setupTokenHash = hashSetupToken(setupToken)
      const setupLink = getSetupLink(setupToken)
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
          teamIds,
          status: provisioningMode === 'ADMIN_CREATE' ? 'ACTIVE' : 'PENDING',
        },
        include: {
          userRole: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })

      await passwordSetupTokenModel.create({
        data: {
          userId: user.id,
          tokenHash: setupTokenHash,
          expiresAt,
        },
      })

      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      })

      const emailResult = await sendWelcomeEmail({
        to: user.email,
        firstName: user.firstName || 'there',
        organizationName: organization?.name || 'your school',
        setupLink,
        expiresAtIso: expiresAt.toISOString(),
        mode: provisioningMode,
      })

      console.log('[WELCOME_LINK]', {
        userId: user.id,
        email: user.email,
        provisioningMode,
        setupLink,
        expiresAt: expiresAt.toISOString(),
        emailSent: emailResult.sent,
        emailReason: emailResult.reason,
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
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to create user:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to create user'),
      { status: 500 }
    )
  }
}
