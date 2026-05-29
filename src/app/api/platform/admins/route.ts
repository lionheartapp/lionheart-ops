import { hash } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
// eslint-disable-next-line no-restricted-imports -- Platform admin routes operate outside tenant org scoping after platform-admin auth/permission checks.
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { logger } from '@/lib/logger'

/**
 * GET /api/platform/admins — List all platform admins
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ADMINS_MANAGE)

    const admins = await rawPrisma.platformAdmin.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(ok(admins))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to manage admins'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to list platform admins')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

const CreateAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).optional(),
  role: z.enum(['SUPER_ADMIN', 'OPERATOR']).default('OPERATOR'),
})

/**
 * POST /api/platform/admins — Create a new platform admin
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ADMINS_MANAGE)

    const body = await req.json()
    const validation = CreateAdminSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', validation.error.issues), { status: 400 })
    }

    const { email, password, name, role } = validation.data

    const existing = await rawPrisma.platformAdmin.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json(fail('CONFLICT', 'An admin with this email already exists'), { status: 409 })
    }

    const passwordHash = await hash(password, 12)

    const admin = await rawPrisma.platformAdmin.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || null,
        role,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })

    // Audit log
    await rawPrisma.platformAuditLog.create({
      data: {
        platformAdminId: ctx.adminId,
        action: 'admin.create',
        resourceType: 'PlatformAdmin',
        resourceId: admin.id,
        details: { email: admin.email, role: admin.role },
      },
    })

    return NextResponse.json(ok(admin), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to manage admins'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to create platform admin')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
