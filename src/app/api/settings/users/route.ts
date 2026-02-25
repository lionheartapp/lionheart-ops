import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma as prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { hashSetupToken } from '@/lib/auth/password-setup'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const DEFAULT_SETUP_EXPIRY_DAYS = 7
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://127.0.0.1:3004'

export async function GET(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.USERS_READ)
  return runWithOrgContext(orgId, async () => {
    const list = await prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        status: true,
        roleId: true,
        teamIds: true,
        jobTitle: true,
        employmentType: true,
        createdAt: true,
        userRole: { select: { id: true, name: true, slug: true } },
      },
    })
    return NextResponse.json(ok(list))
  })
}

export async function POST(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.USERS_INVITE)
  const body = (await req.json()) as {
    firstName?: string
    lastName?: string
    email?: string
    roleId?: string
    teamIds?: string[]
    employmentType?: string
    provisioningMode?: 'ADMIN_CREATE' | 'INVITE_ONLY'
  }
  const email = body.email?.trim()?.toLowerCase()
  if (!email) {
    return NextResponse.json(fail('BAD_REQUEST', 'email is required'), { status: 400 })
  }
  const provisioningMode = body.provisioningMode ?? 'INVITE_ONLY'
  const status = provisioningMode === 'ADMIN_CREATE' ? 'ACTIVE' : 'PENDING'

  return runWithOrgContext(orgId, async () => {
    const existing = await prisma.user.findUnique({
      where: { organizationId_email: { organizationId: orgId, email } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(fail('CONFLICT', 'User with this email already exists'), { status: 409 })
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashSetupToken(rawToken)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_SETUP_EXPIRY_DAYS)

    const tempPassword = status === 'ACTIVE' ? crypto.randomBytes(16).toString('hex') : crypto.randomBytes(32).toString('hex')
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        email,
        firstName: body.firstName?.trim() ?? null,
        lastName: body.lastName?.trim() ?? null,
        name: [body.firstName, body.lastName].filter(Boolean).join(' ') || email,
        passwordHash,
        status,
        roleId: body.roleId ?? null,
        teamIds: Array.isArray(body.teamIds) ? body.teamIds : [],
        employmentType: (body.employmentType as 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN' | 'VOLUNTEER') ?? null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        status: true,
        roleId: true,
        teamIds: true,
        createdAt: true,
        userRole: { select: { id: true, name: true, slug: true } },
      },
    })

    await prisma.passwordSetupToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    const setupLink = `${baseUrl}/set-password?token=${rawToken}`

    return NextResponse.json(
      ok({
        user: { ...user, status: user.status },
        setup: { setupLink },
      }),
      { status: 201 }
    )
  })
}
