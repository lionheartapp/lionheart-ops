import { NextRequest, NextResponse } from 'next/server'
import { decodeJwt } from 'jose'
import { verifyAuthToken } from '@/lib/auth'
import { ok, fail } from '@/lib/api-response'

/**
 * GET /api/auth/token
 *
 * Returns the raw JWT string for the browser Supabase client.
 * Used by the realtime subscription's accessToken param.
 * No DB queries — pure JWT read + verify + return.
 */
export async function GET(req: NextRequest) {
  try {
    // Try cookie first, fall back to Authorization header
    const cookieToken = req.cookies.get('auth-token')?.value
    const authHeader = req.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const token = cookieToken ?? bearerToken

    if (!token) {
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Not authenticated'),
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const claims = await verifyAuthToken(token)
    if (!claims) {
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Invalid or expired token'),
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    // Extract exp from the verified JWT payload (verifyAuthToken strips it)
    const decoded = decodeJwt(token)
    const expiresAt = decoded.exp ?? null

    return NextResponse.json(
      ok({ token, expiresAt }),
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong'),
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
