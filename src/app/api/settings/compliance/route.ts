/**
 * Compliance Settings API
 *
 * GET  — Read DPA (Data Privacy Agreement) status for the org
 * PATCH — Record DPA signing or update DPA details (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { audit, getIp } from '@/lib/services/auditService'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    if (!ctx?.userId || !orgId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const org = await cacheOrgWide(orgId, 'compliance:dpa', () =>
        prisma.organization.findUnique({
          where: { id: orgId },
          select: {
            dpaSignedAt: true,
            dpaSignatoryName: true,
            dpaSignatoryEmail: true,
            dpaVersion: true,
            dpaReviewDueAt: true,
          },
        })
      )

      return NextResponse.json(ok({
        dpaSigned: !!org?.dpaSignedAt,
        dpaSignedAt: org?.dpaSignedAt,
        dpaSignatoryName: org?.dpaSignatoryName,
        dpaSignatoryEmail: org?.dpaSignatoryEmail,
        dpaVersion: org?.dpaVersion,
        dpaReviewDueAt: org?.dpaReviewDueAt,
      }))
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Only administrators can view compliance settings'), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to load compliance settings'), { status: 500 })
  }
}

const UpdateSchema = z.object({
  dpaSignatoryName: z.string().min(1).max(200).optional(),
  dpaSignatoryEmail: z.string().email().optional(),
  dpaVersion: z.string().max(50).optional(),
  dpaReviewDueAt: z.string().datetime().optional().nullable(),
  recordSigning: z.boolean().optional(), // Set to true to stamp dpaSignedAt
  revoke: z.boolean().optional(), // Set to true to clear all DPA fields
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
      const data: Record<string, unknown> = {}

      if (input.revoke) {
        data.dpaSignedAt = null
        data.dpaSignatoryName = null
        data.dpaSignatoryEmail = null
        data.dpaVersion = null
        data.dpaReviewDueAt = null
      } else {
        if (input.recordSigning) data.dpaSignedAt = new Date()
        if (input.dpaSignatoryName) data.dpaSignatoryName = input.dpaSignatoryName
        if (input.dpaSignatoryEmail) data.dpaSignatoryEmail = input.dpaSignatoryEmail
        if (input.dpaVersion) data.dpaVersion = input.dpaVersion
        if (input.dpaReviewDueAt !== undefined) {
          data.dpaReviewDueAt = input.dpaReviewDueAt ? new Date(input.dpaReviewDueAt) : null
        }
      }

      const updated = await prisma.organization.update({
        where: { id: orgId },
        data,
        select: {
          dpaSignedAt: true,
          dpaSignatoryName: true,
          dpaSignatoryEmail: true,
          dpaVersion: true,
          dpaReviewDueAt: true,
        },
      })

      // DPA fields are cached via the compliance bucket — nuke stale reads.
      invalidateOrgCache(orgId, 'compliance')

      // Audit log the DPA change
      void audit({
        organizationId: orgId,
        userId: ctx.userId,
        userEmail: ctx.email,
        action: input.revoke ? 'dpa.revoked' : 'dpa.signed',
        resourceType: 'Organization',
        resourceId: orgId,
        changes: input.revoke ? { revoked: true } : {
          signatoryName: input.dpaSignatoryName,
          version: input.dpaVersion,
        },
        ipAddress: getIp(req),
      })

      return NextResponse.json(ok({
        dpaSigned: !!updated.dpaSignedAt,
        dpaSignedAt: updated.dpaSignedAt,
        dpaSignatoryName: updated.dpaSignatoryName,
        dpaSignatoryEmail: updated.dpaSignatoryEmail,
        dpaVersion: updated.dpaVersion,
        dpaReviewDueAt: updated.dpaReviewDueAt,
      }))
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Only administrators can manage compliance settings'), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update compliance settings'), { status: 500 })
  }
}
