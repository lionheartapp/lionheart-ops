/**
 * GET /api/registration/magic-link/validate?token=xxx
 *
 * PUBLIC route. Consumes a magic link token and issues a short-lived portal JWT.
 * The client saves the portalToken to localStorage and redirects to the portal page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { consumeMagicLink } from '@/lib/services/registrationMagicLinkService'

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token || token.length < 10) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Missing or invalid token parameter'),
        { status: 400 },
      )
    }

    const result = await consumeMagicLink(token)

    return NextResponse.json(
      ok({
        portalToken: result.portalToken,
        registrationId: result.registrationId,
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'

    if (message === 'TOKEN_ALREADY_USED') {
      return NextResponse.json(
        fail('TOKEN_ALREADY_USED', 'This link has already been used. Please request a new one.'),
        { status: 401 },
      )
    }

    if (message === 'TOKEN_EXPIRED') {
      return NextResponse.json(
        fail('TOKEN_EXPIRED', 'This link has expired. Please request a new one.'),
        { status: 401 },
      )
    }

    if (message === 'INVALID_TOKEN') {
      return NextResponse.json(
        fail('INVALID_TOKEN', 'This link is invalid. Please request a new one.'),
        { status: 401 },
      )
    }

    console.error('[magic-link/validate] Unexpected error:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong. Please try again.'),
      { status: 500 },
    )
  }
}
