import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { clearCookieOptions } from '@/lib/auth/cookie-options'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

/**
 * POST /api/auth/logout
 *
 * Clears the auth-token and csrf-token cookies server-side.
 * Does not require full auth — just clears cookies regardless.
 */
export async function POST() {
  const log = logger.child({ route: '/api/auth/logout', method: 'POST' })
  try {
    const response = NextResponse.json(ok({ success: true }))

    // Clear auth + csrf cookies. Must match the domain the original set
    // used (`.lionheartapp.com` in prod) or the browser won't clear them.
    response.cookies.set('auth-token', '', clearCookieOptions())
    response.cookies.set('csrf-token', '', { ...clearCookieOptions(), httpOnly: false })

    return response
  } catch (error) {
    log.error({ err: error }, 'Failed to process logout')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
