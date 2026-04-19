/**
 * Passkey Registration Options — generates a WebAuthn registration challenge.
 * Requires authentication (user must be logged in to add a passkey).
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { generateRegistrationOptions } from '@/lib/services/passkeyService'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    if (!ctx?.userId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const { options, challengeId } = await generateRegistrationOptions(ctx.userId)

    return NextResponse.json(ok({ options, challengeId }))
  } catch (err) {
    logger.error({ error: String(err) }, 'Passkey registration options error')
    return NextResponse.json(
      fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to generate registration options'),
      { status: 500 }
    )
  }
}
