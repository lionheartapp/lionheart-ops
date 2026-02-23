import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { rawPrisma as prisma } from '@/lib/db'
import { hashSetupToken } from '@/lib/auth/password-setup'

export async function GET(req: NextRequest) {
  try {
    const passwordSetupTokenModel = (prisma as any).passwordSetupToken
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')?.trim()

    if (!token) {
      return NextResponse.json(fail('BAD_REQUEST', 'token is required'), { status: 400 })
    }

    const tokenHash = hashSetupToken(token)
    const setupToken = await passwordSetupTokenModel.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
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

    return NextResponse.json(
      ok({
        valid: true,
        email: setupToken.user.email,
        userStatus: setupToken.user.status,
      })
    )
  } catch (error) {
    console.error('Validate setup token error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to validate setup token'), { status: 500 })
  }
}
