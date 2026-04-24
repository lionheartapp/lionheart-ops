/**
 * Passkey List — returns the user's registered passkeys.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { listPasskeys } from '@/lib/services/passkeyService'
import { cachePerUser } from '@/lib/cache/route-cache'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    if (!ctx?.userId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const passkeys = await cachePerUser(
      ctx.userId,
      'auth:passkeys',
      () => listPasskeys(ctx.userId),
      { ttlMs: 60000 }
    )

    return NextResponse.json(ok(passkeys))
  } catch (err) {
    logger.error({ error: String(err) }, 'Passkey list error')
    return NextResponse.json(
      fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to list passkeys'),
      { status: 500 }
    )
  }
}
