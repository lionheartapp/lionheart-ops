/**
 * MFA Confirm API
 *
 * POST — Verify the user's first TOTP code to confirm setup.
 * Saves the secret and generates backup codes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/request-context'
import { ok, fail } from '@/lib/api-response'
import { confirmMfaSetup } from '@/lib/services/mfaService'
import { z } from 'zod'

const schema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6, 'Code must be 6 digits'),
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

    const { backupCodes } = await confirmMfaSetup(ctx.userId, parsed.data.secret, parsed.data.code)

    return NextResponse.json(ok({ backupCodes }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to confirm MFA setup'
    const status = message.includes('Invalid verification') ? 400 : 500
    return NextResponse.json(fail('MFA_ERROR', message), { status })
  }
}
