import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { platformAudit, getPlatformIp } from '@/lib/services/platformAuditService'
import { logger } from '@/lib/logger'

/**
 * GET /api/platform/organizations/[id]/modules
 * List all enabled modules for an organization, plus its campuses for campus-scoped modules.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)
    const { id } = await params

    const [modules, campuses] = await Promise.all([
      rawPrisma.tenantModule.findMany({
        where: { organizationId: id },
        select: { id: true, moduleId: true, schoolId: true, enabledAt: true, planTier: true },
      }),
      rawPrisma.campus.findMany({
        where: { organizationId: id },
        select: { id: true, name: true, isActive: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json(ok({ modules, campuses }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to list org modules')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

const ToggleModuleSchema = z.object({
  moduleId: z.string().min(1),
  enabled: z.boolean(),
  /** For campus-scoped modules; omit for org-level toggle */
  campusId: z.string().optional(),
})

/**
 * POST /api/platform/organizations/[id]/modules
 * Enable or disable a module for an organization (platform admin override).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ORGANIZATIONS_UPDATE)
    const { id } = await params

    const body = await req.json()
    const validation = ToggleModuleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', validation.error.issues), { status: 400 })
    }

    const { moduleId, enabled, campusId } = validation.data

    // Verify org exists
    const org = await rawPrisma.organization.findUnique({ where: { id }, select: { id: true, name: true } })
    if (!org) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    if (enabled) {
      // Enable: upsert the module
      await rawPrisma.tenantModule.upsert({
        where: {
          organizationId_moduleId_schoolId: {
            organizationId: id,
            moduleId,
            schoolId: campusId ?? '',
          },
        },
        create: {
          organizationId: id,
          moduleId,
          schoolId: campusId || null,
          planTier: 'platform-granted',
        },
        update: {
          enabledAt: new Date(),
          planTier: 'platform-granted',
        },
      })
    } else {
      // Disable: delete the module record
      await rawPrisma.tenantModule.deleteMany({
        where: {
          organizationId: id,
          moduleId,
          ...(campusId ? { schoolId: campusId } : {}),
        },
      })
    }

    platformAudit({
      platformAdminId: ctx.adminId,
      action: enabled ? 'organization.module.enable' : 'organization.module.disable',
      resourceType: 'Organization',
      resourceId: id,
      details: { moduleId, campusId: campusId || null, orgName: org.name },
      ipAddress: getPlatformIp(req),
    })

    return NextResponse.json(ok({ moduleId, campusId: campusId || null, enabled }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to toggle org module')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
