/**
 * Passkey Authentication Options — generates a WebAuthn assertion challenge during login.
 * Public route (uses temporary MFA token, not auth cookie).
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { verifyAuthToken } from '@/lib/auth'
import { generateAuthenticationOptions } from '@/lib/services/passkeyService'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const schema = z.object({
  mfaToken: z.string().min(1, 'MFA token is required'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    const claims = await verifyAuthToken(parsed.data.mfaToken)
    if (!claims?.userId) {
      return NextResponse.json(
        fail('INVALID_TOKEN', 'Invalid or expired MFA session. Please log in again.'),
        { status: 401 }
      )
    }

    const { options, challengeId } = await generateAuthenticationOptions(claims.userId)

    return NextResponse.json(ok({ options, challengeId }))
  } catch (err) {
    logger.error({ error: String(err) }, 'Passkey authentication options error')
    return NextResponse.json(
      fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to generate authentication options'),
      { status: 500 }
    )
  }
}
