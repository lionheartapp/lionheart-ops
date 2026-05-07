import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { syncRolePermissions } from '@/lib/services/organizationRegistrationService'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/modules', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      const rows = await cacheOrgWide(orgId, 'modules:list', () =>
        (prisma as unknown as OrgPrismaClient).tenantModule.findMany({
          where: { organizationId: orgId },
          orderBy: { enabledAt: 'asc' },
        })
      )
      // Map schoolId → campusId for frontend compatibility
      const modules = rows.map(({ schoolId, ...rest }) => ({ ...rest, campusId: schoolId }))
      return NextResponse.json(ok(modules))
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if ((msg.includes('Insufficient permissions') || msg.includes('Permission denied'))) {
      return NextResponse.json(fail('FORBIDDEN', msg), { status: 403 })
    }
    if (msg.includes('Missing') || msg.includes('Unauthorized') || msg.includes('Invalid token') || msg.includes('x-org-id')) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
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
      const db = prisma as unknown as OrgPrismaClient

      const whereFilter = {
        organizationId: orgId,
        moduleId: input.moduleId,
        ...(input.campusId ? { schoolId: input.campusId } : { schoolId: null }),
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
            schoolId: input.campusId ?? null,
            planTier: 'trial',
          },
        })

        invalidateOrgCache(orgId, 'modules')

        // Sync role permissions in the background — don't block the UI
        // (this upserts ~200+ permission rows which takes several seconds)
        syncRolePermissions(orgId).catch((err) => {
          log.error({ err }, 'Background role permission sync failed')
          Sentry.captureException(err)
        })

        return NextResponse.json(ok(mod), { status: 200 })
      } else {
        await db.tenantModule.deleteMany({ where: whereFilter })
        invalidateOrgCache(orgId, 'modules')
        return NextResponse.json(ok({ moduleId: input.moduleId, campusId: input.campusId ?? null, enabled: false }))
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && (error.message.includes('Insufficient permissions') || error.message.includes('Permission denied'))) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    const errMsg = error instanceof Error ? error.message : String(error)
    const errStack = error instanceof Error ? error.stack : undefined
    log.error({ err: error, errMsg, errStack }, 'Failed to toggle module')
    console.error('[modules POST] Failed to toggle module:', errMsg, errStack)
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', `Failed to toggle module: ${errMsg}`), { status: 500 })
  }
}
