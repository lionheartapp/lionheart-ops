/**
 * GET /api/it/sync/configs — list sync configurations
 * POST /api/it/sync/configs — create/update sync configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const UpsertSyncConfigSchema = z.object({
  provider: z.string().min(1),
  isEnabled: z.boolean().default(false),
  credentials: z.record(z.string(), z.unknown()).optional(),
  syncSchedule: z.string().optional(),
  schoolMappings: z.record(z.string(), z.string()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_ROSTER_CONFIGURE)

    const configs = await runWithOrgContext(orgId, async () =>
      (prisma.iTSyncConfig.findMany as Function)({
        orderBy: { provider: 'asc' },
        select: {
          id: true,
          provider: true,
          isEnabled: true,
          syncSchedule: true,
          lastSyncAt: true,
          lastSyncStatus: true,
          lastSyncError: true,
          schoolMappings: true,
          settings: true,
          // Never expose credentials
        },
      })
    )

    return NextResponse.json(ok(configs))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/sync/configs]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_ROSTER_CONFIGURE)

    const body = await req.json()
    const validated = UpsertSyncConfigSchema.parse(body)

    const config = await runWithOrgContext(orgId, async () =>
      (prisma.iTSyncConfig.upsert as Function)({
        where: {
          organizationId_provider: {
            organizationId: orgId,
            provider: validated.provider,
          },
        },
        create: {
          provider: validated.provider,
          isEnabled: validated.isEnabled,
          credentials: validated.credentials ?? undefined,
          syncSchedule: validated.syncSchedule,
          schoolMappings: validated.schoolMappings ?? undefined,
          settings: validated.settings ?? undefined,
        },
        update: {
          isEnabled: validated.isEnabled,
          ...(validated.credentials && { credentials: validated.credentials }),
          syncSchedule: validated.syncSchedule,
          ...(validated.schoolMappings && { schoolMappings: validated.schoolMappings }),
          ...(validated.settings && { settings: validated.settings }),
        },
        select: {
          id: true,
          provider: true,
          isEnabled: true,
          syncSchedule: true,
          lastSyncAt: true,
          lastSyncStatus: true,
          schoolMappings: true,
          settings: true,
        },
      })
    )

    return NextResponse.json(ok(config))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[POST /api/it/sync/configs]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
