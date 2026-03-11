import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { syncRolePermissions } from '@/lib/services/organizationRegistrationService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/modules', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      const modules = await (prisma as any).tenantModule.findMany({
        where: { organizationId: orgId },
        orderBy: { enabledAt: 'asc' },
      })
      return NextResponse.json(ok(modules))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to fetch modules')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch modules'), { status: 500 })
  }
}

const ToggleModuleSchema = z.object({
  moduleId: z.string().min(1),
  enabled: z.boolean(),
  campusId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/modules', method: 'POST' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    const body = await req.json()

    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const input = ToggleModuleSchema.parse(body)
      const db = prisma as any

      const whereFilter = {
        organizationId: orgId,
        moduleId: input.moduleId,
        ...(input.campusId ? { campusId: input.campusId } : { campusId: null }),
      }

      if (input.enabled) {
        const existing = await db.tenantModule.findFirst({ where: whereFilter })
        if (existing) {
          return NextResponse.json(ok(existing), { status: 200 })
        }
        const mod = await db.tenantModule.create({
          data: {
            organizationId: orgId,
            moduleId: input.moduleId,
            campusId: input.campusId ?? null,
          },
        })

        // Sync role permissions so existing orgs get any new permissions/roles
        // that were added as part of this module (e.g., IT Coordinator, Secretary)
        await syncRolePermissions(orgId)

        return NextResponse.json(ok(mod), { status: 200 })
      } else {
        await db.tenantModule.deleteMany({ where: whereFilter })
        return NextResponse.json(ok({ moduleId: input.moduleId, campusId: input.campusId ?? null, enabled: false }))
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to toggle module')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to toggle module'), { status: 500 })
  }
}
