/**
 * POST /api/it/magic-links — Generate a magic link for substitute teacher submission
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

export const POST = withAuth(async ({ orgId, ctx, req }) => {
  const body = await req.json()
  const { schoolId, campusId, expiresInHours } = body

  // Generate a secure random token
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  // Default: expires at end of school day (8 hours), max 5 days
  const hours = Math.min(expiresInHours || 8, 120)
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)

  await prisma.iTMagicLink.create({
    data: {
      organizationId: orgId,
      tokenHash,
      campusId: campusId || null,
      schoolId: schoolId || null,
      createdById: ctx.userId,
      expiresAt,
    },
  })

  // Return the raw token (not the hash) — this is the only time it's visible
  return NextResponse.json(ok({
    token: rawToken,
    expiresAt: expiresAt.toISOString(),
    url: `/it/sub?token=${rawToken}`,
  }), { status: 201 })
}, { permission: PERMISSIONS.IT_MAGICLINK_GENERATE })
