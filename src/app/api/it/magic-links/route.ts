/**
 * POST /api/it/magic-links — Generate a magic link for substitute teacher submission
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_MAGICLINK_GENERATE)

    const body = await req.json()
    const { schoolId, campusId, expiresInHours } = body

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    // Default: expires at end of school day (8 hours), max 5 days
    const hours = Math.min(expiresInHours || 8, 120)
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)

    await runWithOrgContext(orgId, () =>
      prisma.iTMagicLink.create({
        data: {
          organizationId: orgId,
          tokenHash,
          campusId: campusId || null,
          schoolId: schoolId || null,
          createdById: ctx.userId,
          expiresAt,
        },
      })
    )

    // Return the raw token (not the hash) — this is the only time it's visible
    return NextResponse.json(ok({
      token: rawToken,
      expiresAt: expiresAt.toISOString(),
      url: `/it/sub?token=${rawToken}`,
    }), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/it/magic-links]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
