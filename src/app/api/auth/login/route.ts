import { compare } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { runWithOrgContext } from '@/lib/org-context'
import { signAuthToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
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

    const teams = user.teamIds.length
      ? await prisma.team.findMany({
          where: {
            organizationId,
            slug: {
              in: user.teamIds,
            },
          },
          select: {
            name: true,
          },
          take: 1,
        })
      : []

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
          team: teams[0]?.name || null,
        },
      })
    )
  })
}
