import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { hashSetupToken } from '@/lib/auth/password-setup'

/** GET /api/auth/set-password/validate?token=... — check if a setup token is valid and unused. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim()
  if (!token) {
    return NextResponse.json(fail('BAD_REQUEST', 'token query parameter is required'), { status: 400 })
  }

  const tokenHash = hashSetupToken(token)
  const passwordSetupTokenModel = (prisma as { passwordSetupToken: { findUnique: (args: unknown) => Promise<unknown> } }).passwordSetupToken
  const setupToken = await passwordSetupTokenModel.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
    },
  }) as { id: string; usedAt: Date | null; expiresAt: Date } | null

  if (!setupToken) {
    return NextResponse.json(ok({ valid: false, reason: 'INVALID_TOKEN' }))
  }
  if (setupToken.usedAt) {
    return NextResponse.json(ok({ valid: false, reason: 'TOKEN_USED' }))
  }
  if (setupToken.expiresAt < new Date()) {
    return NextResponse.json(ok({ valid: false, reason: 'TOKEN_EXPIRED' }))
  }

  return NextResponse.json(ok({ valid: true }))
}
