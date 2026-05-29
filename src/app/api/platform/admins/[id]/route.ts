import { hash } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
// eslint-disable-next-line no-restricted-imports -- Platform admin routes operate outside tenant org scoping after platform-admin auth/permission checks.
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { logger } from '@/lib/logger'

const UpdateAdminSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['SUPER_ADMIN', 'OPERATOR']).optional(),
  password: z.string().min(8).optional(),
})

/**
 * PATCH /api/platform/admins/[id] — Update a platform admin
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ADMINS_MANAGE)
    const { id } = await params

    const body = await req.json()
    const validation = UpdateAdminSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', validation.error.issues), { status: 400 })
    }

    const existing = await rawPrisma.platformAdmin.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(fail('NOT_FOUND', 'Admin not found'), { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (validation.data.name !== undefined) data.name = validation.data.name
    if (validation.data.role !== undefined) data.role = validation.data.role
    if (validation.data.password) data.passwordHash = await hash(validation.data.password, 12)

    const updated = await rawPrisma.platformAdmin.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true },
    })

    await rawPrisma.platformAuditLog.create({
      data: {
        platformAdminId: ctx.adminId,
        action: 'admin.update',
        resourceType: 'PlatformAdmin',
        resourceId: id,
        details: { changes: Object.keys(data).filter(k => k !== 'passwordHash') },
      },
    })

    return NextResponse.json(ok(updated))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to manage admins'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to update platform admin')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * DELETE /api/platform/admins/[id] — Delete a platform admin
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ADMINS_MANAGE)
    const { id } = await params

    // Prevent self-deletion
    if (id === ctx.adminId) {
      return NextResponse.json(fail('BAD_REQUEST', 'You cannot delete your own account'), { status: 400 })
    }

    // Ensure at least one super admin remains
    const superAdminCount = await rawPrisma.platformAdmin.count({ where: { role: 'SUPER_ADMIN' } })
    const target = await rawPrisma.platformAdmin.findUnique({ where: { id }, select: { role: true, email: true } })
    if (!target) {
      return NextResponse.json(fail('NOT_FOUND', 'Admin not found'), { status: 404 })
    }
    if (target.role === 'SUPER_ADMIN' && superAdminCount <= 1) {
      return NextResponse.json(fail('BAD_REQUEST', 'Cannot delete the last super admin'), { status: 400 })
    }

    await rawPrisma.platformAdmin.delete({ where: { id } })

    await rawPrisma.platformAuditLog.create({
      data: {
        platformAdminId: ctx.adminId,
        action: 'admin.delete',
        resourceType: 'PlatformAdmin',
        resourceId: id,
        details: { email: target.email },
      },
    })

    return NextResponse.json(ok({ deleted: true }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to manage admins'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to delete platform admin')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
