/**
 * MFA Setup API
 *
 * POST — Generate a new TOTP secret and QR code for the user to scan.
 * Returns the secret and QR code data URL. The secret is NOT saved yet —
 * it's only persisted after the user verifies their first code via /confirm.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/request-context'
import { ok, fail } from '@/lib/api-response'
import { generateMfaSetup } from '@/lib/services/mfaService'

export async function POST(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    if (!ctx?.userId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const setup = await generateMfaSetup(ctx.userId)

    return NextResponse.json(ok({
      secret: setup.secret,
      qrCodeDataUrl: setup.qrCodeDataUrl,
    }))
  } catch (err) {
    return NextResponse.json(
      fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to generate MFA setup'),
      { status: 500 }
    )
  }
}
