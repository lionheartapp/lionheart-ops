/**
 * Security Settings API
 *
 * GET  — Read org security settings (mfaRequired)
 * PATCH — Update org security settings (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    if (!ctx?.userId || !orgId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    return await runWithOrgContext(orgId, async () => {
      const org = await cacheOrgWide(orgId, 'security:mfa', () =>
        prisma.organization.findUnique({
          where: { id: orgId },
          select: { mfaRequired: true },
        })
      )

      return NextResponse.json(ok({ mfaRequired: org?.mfaRequired ?? false }))
    })
  } catch {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to load security settings'), { status: 500 })
  }
}

const UpdateSchema = z.object({
  mfaRequired: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    if (!ctx?.userId || !orgId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    await assertCan(ctx.userId, PERMISSIONS.ALL)

    const body = await req.json()
    const input = UpdateSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      const updated = await prisma.organization.update({
        where: { id: orgId },
        data: {
          ...(input.mfaRequired !== undefined ? { mfaRequired: input.mfaRequired } : {}),
        },
        select: { mfaRequired: true },
      })

      invalidateOrgCache(orgId, 'security')

      return NextResponse.json(ok({ mfaRequired: updated.mfaRequired }))
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Only administrators can change security settings'), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update security settings'), { status: 500 })
  }
}
