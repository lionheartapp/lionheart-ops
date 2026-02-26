import { compare } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { runWithOrgContext } from '@/lib/org-context'
import { signAuthToken } from '@/lib/auth'
import { audit, getIp } from '@/lib/services/auditService'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string; organizationId?: string }
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const organizationId = body.organizationId?.trim()

    if (!email || !password || !organizationId) {
      return NextResponse.json(fail('BAD_REQUEST', 'email, password, and organizationId are required'), { status: 400 })
    }

    return await runWithOrgContext(organizationId, async () => {
      const user = await prisma.user.findFirst({
        where: { email },
        include: {
          userRole: {
            select: {
              name: true,
            },
          },
        },
      })
      if (!user) {
        return NextResponse.json(fail('UNAUTHORIZED', 'Invalid credentials'), { status: 401 })
      }

      if (user.status !== 'ACTIVE') {
        return NextResponse.json(
          fail('UNAUTHORIZED', 'Account is pending approval or inactive. Please contact an administrator.'),
          { status: 401 }
        )
      }

      const valid = await compare(password, user.passwordHash)
      if (!valid) {
        return NextResponse.json(fail('UNAUTHORIZED', 'Invalid credentials'), { status: 401 })
      }

      const token = await signAuthToken({
        userId: user.id,
        organizationId,
        email: user.email,
      })

      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          logoUrl: true,
          gradeLevel: true,
        },
      })

      // Fetch team via junction table (take just one for display in the login response)
      const firstMembership = await prisma.userTeam.findFirst({
        where: { userId: user.id },
        select: { team: { select: { name: true } } },
      })
      const teamName = firstMembership?.team?.name ?? null

      // Fire-and-forget audit log (non-critical)
      void audit({
        organizationId,
        userId:        user.id,
        userEmail:     user.email,
        action:        'user.login',
        resourceType:  'User',
        resourceId:    user.id,
        resourceLabel: user.email,
        ipAddress:     getIp(req),
      })

      return NextResponse.json(
        ok({
          token,
          organizationId,
          organization,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            schoolScope: user.schoolScope,
            role: user.userRole?.name || null,
            team: teamName,
          },
        })
      )
    })
  } catch (error) {
    console.error('[POST /api/auth/login]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
