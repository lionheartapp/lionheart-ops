import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { platformAudit, getPlatformIp } from '@/lib/services/platformAuditService'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)
    const { id } = await params

    const org = await rawPrisma.organization.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            tickets: { where: { deletedAt: null } },
            events: { where: { deletedAt: null } },
            schools: { where: { deletedAt: null } },
          },
        },
      },
    })

    if (!org) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    return NextResponse.json(ok(org))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to get organization')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ORGANIZATIONS_UPDATE)
    const { id } = await params

    const body = await req.json()
    const allowedFields = ['onboardingStatus', 'stripeCustomerId']
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) data[field] = body[field]
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(fail('BAD_REQUEST', 'No valid fields to update'), { status: 400 })
    }

    const org = await rawPrisma.organization.update({
      where: { id },
      data,
    })

    platformAudit({
      platformAdminId: ctx.adminId,
      action: 'organization.update',
      resourceType: 'Organization',
      resourceId: id,
      details: { changes: data },
      ipAddress: getPlatformIp(req),
    })

    return NextResponse.json(ok(org))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to update organization')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

const DeleteSchema = z.object({
  confirmSlug: z.string().min(1, 'Confirmation slug is required'),
})

/**
 * DELETE /api/platform/organizations/[id] — Permanently delete an organization and all its data
 *
 * Requires the org slug as confirmation to prevent accidental deletion.
 * Cascading deletes are handled by the database (onDelete: Cascade on child relations).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getPlatformContext(req)
    // Only super admins can permanently delete organizations
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ALL)
    const { id } = await params

    const body = await req.json()
    const validation = DeleteSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', validation.error.issues), { status: 400 })
    }

    // Fetch org to verify it exists and confirm slug
    const org = await rawPrisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, _count: { select: { users: true } } },
    })

    if (!org) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    if (validation.data.confirmSlug !== org.slug) {
      return NextResponse.json(
        fail('BAD_REQUEST', `Slug mismatch. Type "${org.slug}" to confirm deletion.`),
        { status: 400 }
      )
    }

    // Log before deletion (audit record references admin, not org)
    platformAudit({
      platformAdminId: ctx.adminId,
      action: 'organization.delete',
      resourceType: 'Organization',
      resourceId: id,
      details: { name: org.name, slug: org.slug, userCount: org._count.users },
      ipAddress: getPlatformIp(req),
    })

    // Delete the organization — cascading deletes handle all child records
    await rawPrisma.organization.delete({ where: { id } })

    logger.warn({ orgId: id, orgSlug: org.slug, deletedBy: ctx.adminId }, 'Organization permanently deleted')

    return NextResponse.json(ok({ deleted: true, name: org.name, slug: org.slug }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Only super admins can delete organizations'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to delete organization')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
