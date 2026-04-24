/**
 * MFA Backup Code Regeneration API
 *
 * POST — Regenerate backup codes for the authenticated user.
 * Requires password confirmation to prevent unauthorized regeneration.
 * Invalidates all existing backup codes and returns fresh ones.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/request-context'
import { ok, fail } from '@/lib/api-response'
import { regenerateBackupCodes } from '@/lib/services/mfaService'
import { rawPrisma } from '@/lib/db'
import { compare } from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    if (!ctx?.userId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const body = await req.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Password is required to regenerate backup codes'),
        { status: 400 }
      )
    }

    // Verify password
    const user = await rawPrisma.user.findUnique({
      where: { id: ctx.userId },
      select: { passwordHash: true, mfaEnabled: true },
    })

    if (!user) {
      return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
    }

    if (!user.mfaEnabled) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'MFA is not enabled on this account'),
        { status: 400 }
      )
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'No password set on this account'),
        { status: 400 }
      )
    }

    const passwordValid = await compare(password, user.passwordHash)
    if (!passwordValid) {
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Incorrect password'),
        { status: 401 }
      )
    }

    const backupCodes = await regenerateBackupCodes(ctx.userId)

    return NextResponse.json(ok({ backupCodes }))
  } catch (err) {
    return NextResponse.json(
      fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to regenerate backup codes'),
      { status: 500 }
    )
  }
}
