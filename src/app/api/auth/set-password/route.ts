import { hash } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { rawPrisma as prisma } from '@/lib/db'
import { hashSetupToken } from '@/lib/auth/password-setup'

export async function POST(req: NextRequest) {
  try {
    const passwordSetupTokenModel = (prisma as any).passwordSetupToken
    const body = (await req.json()) as { token?: string; password?: string }
    const token = body.token?.trim()
    const password = body.password?.trim()

    if (!token || !password) {
      return NextResponse.json(fail('BAD_REQUEST', 'token and password are required'), { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(fail('BAD_REQUEST', 'Password must be at least 8 characters'), { status: 400 })
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
        where: { id: setupToken.userId },
        data: {
          passwordHash,
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
