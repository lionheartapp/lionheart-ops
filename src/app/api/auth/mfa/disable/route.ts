/**
 * MFA Disable API
 *
 * POST — Disable two-factor authentication for the current user.
 * Requires password confirmation for security.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/request-context'
import { ok, fail } from '@/lib/api-response'
import { disableMfa, isOrgMfaRequired } from '@/lib/services/mfaService'
import { rawPrisma } from '@/lib/db'
import { compare } from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  password: z.string().min(1, 'Password is required'),
})

export async function POST(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)
    if (!ctx?.userId || !ctx?.organizationId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    // Check if org requires MFA — can't disable if so
    if (await isOrgMfaRequired(ctx.organizationId)) {
      return NextResponse.json(
        fail('MFA_REQUIRED', 'Your organization requires two-factor authentication. Contact your admin to change this policy.'),
        { status: 403 }
      )
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    // Verify password before allowing disable
    const user = await rawPrisma.user.findUnique({
      where: { id: ctx.userId },
      select: { passwordHash: true },
    })

    if (!user?.passwordHash) {
      return NextResponse.json(fail('NO_PASSWORD', 'No password set on this account'), { status: 400 })
    }

    const passwordValid = await compare(parsed.data.password, user.passwordHash)
    if (!passwordValid) {
      return NextResponse.json(fail('INVALID_PASSWORD', 'Incorrect password'), { status: 400 })
    }

    await disableMfa(ctx.userId)

    return NextResponse.json(ok({ disabled: true }))
  } catch (err) {
    return NextResponse.json(
      fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to disable MFA'),
      { status: 500 }
    )
  }
}
