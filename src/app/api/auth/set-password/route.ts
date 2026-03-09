import { hash } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { rawPrisma as prisma } from '@/lib/db'
import { hashSetupToken } from '@/lib/auth/password-setup'
import { passwordSchema } from '@/lib/validation/password'
import { ZodError } from 'zod'

export async function POST(req: NextRequest) {
  try {
    const passwordSetupTokenModel = (prisma as any).passwordSetupToken
    const body = (await req.json()) as { token?: string; password?: string }
    const token = body.token?.trim()
    const password = body.password?.trim()

    if (!token || !password) {
      return NextResponse.json(fail('BAD_REQUEST', 'token and password are required'), { status: 400 })
    }

    try {
      passwordSchema.parse(password)
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.issues[0]?.message || 'Password does not meet complexity requirements'
        return NextResponse.json(fail('BAD_REQUEST', message), { status: 400 })
      }
      throw err
    }

    const tokenHash = hashSetupToken(token)
    const setupToken = await passwordSetupTokenModel.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            organizationId: true,
          },
        },
      },
    })

    if (!setupToken) {
      return NextResponse.json(fail('INVALID_TOKEN', 'Invalid setup token'), { status: 400 })
    }

    if (setupToken.usedAt) {
      return NextResponse.json(fail('TOKEN_USED', 'This setup link has already been used'), { status: 400 })
    }

    if (setupToken.expiresAt < new Date()) {
      return NextResponse.json(fail('TOKEN_EXPIRED', 'This setup link has expired'), { status: 400 })
    }

    const passwordHash = await hash(password, 10)

    await prisma.$transaction([
      prisma.user.update({
        where: {
          organizationId_email: {
            organizationId: setupToken.user.organizationId,
            email: setupToken.user.email,
          },
        },
        data: {
          passwordHash,
          emailVerified: true, // Invite link proves email ownership
        },
      }),
      passwordSetupTokenModel.update({
        where: { id: setupToken.id },
        data: {
          usedAt: new Date(),
        },
      }),
    ])

    return NextResponse.json(ok({ success: true }))
  } catch (error) {
    console.error('Set password error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to set password'), { status: 500 })
  }
}
