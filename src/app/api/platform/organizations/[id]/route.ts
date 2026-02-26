import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { platformAudit, getPlatformIp } from '@/lib/services/platformAuditService'

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
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/platform/organizations/[id]]', error)
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
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[PATCH /api/platform/organizations/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
