import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
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

    // Clear auth cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })

    // Clear CSRF cookie
    response.cookies.set('csrf-token', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })

    return response
  } catch (error) {
    log.error({ err: error }, 'Failed to process logout')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
