/**
 * Passkey Registration Verify — verifies the attestation and saves the credential.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { verifyAndSaveRegistration } from '@/lib/services/passkeyService'
import { invalidateUserCache } from '@/lib/cache/route-cache'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const schema = z.object({
  credential: z.record(z.string(), z.unknown()),
  challengeId: z.string().min(1),
  name: z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    if (!ctx?.userId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    const { credential, challengeId, name } = parsed.data
    const result = await verifyAndSaveRegistration(
      ctx.userId,
      credential as never,
      challengeId,
      name
    )

    invalidateUserCache(ctx.userId, 'auth:passkeys')

    logger.info({ userId: ctx.userId }, 'Passkey registered successfully')

    return NextResponse.json(ok(result))
  } catch (err) {
    logger.error({ error: String(err) }, 'Passkey registration verify error')
    return NextResponse.json(
      fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Registration verification failed'),
      { status: 500 }
    )
  }
}
