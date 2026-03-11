import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { audit, getIp } from '@/lib/services/auditService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const OrgUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(50)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug can only contain lowercase letters, numbers, and hyphens'
    )
    .optional(),
})

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/settings/organization', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_READ)

    const org = await rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, slug: true },
    })

    if (!org) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    return NextResponse.json(ok(org))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to fetch organization settings')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const log = logger.child({ route: '/api/settings/organization', method: 'PATCH' })
  try {
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_READ)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid JSON body'), { status: 400 })
    }

    const parsed = OrgUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const details = parsed.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      return NextResponse.json(fail('VALIDATION_ERROR', 'Validation failed', details), { status: 400 })
    }

    const { name, slug } = parsed.data

    if (!name && !slug) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'At least one of name or slug must be provided'),
        { status: 400 }
      )
    }

    // If slug is changing, check uniqueness
    if (slug) {
      const existing = await rawPrisma.organization.findFirst({
        where: { slug, id: { not: orgId } },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'Slug already taken'),
          { status: 400 }
        )
      }
    }

    const updated = await rawPrisma.organization.update({
      where: { id: orgId },
      data: {
        ...(name ? { name } : {}),
        ...(slug ? { slug } : {}),
      },
      select: { name: true, slug: true },
    })

    await audit({
      organizationId: orgId,
      userId: ctx.userId,
      userEmail: ctx.email,
      action: 'organization.update',
      resourceType: 'Organization',
      resourceId: orgId,
      changes: { name, slug },
      ipAddress: getIp(req),
    })

    return NextResponse.json(ok(updated))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to update organization settings')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
