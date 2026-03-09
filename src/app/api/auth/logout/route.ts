import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'

/**
 * POST /api/auth/logout
 *
 * Clears the auth-token and csrf-token cookies server-side.
 * Does not require full auth — just clears cookies regardless.
 */
export async function POST() {
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
}
