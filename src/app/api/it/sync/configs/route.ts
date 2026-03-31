/**
 * GET /api/it/sync/configs — list sync configurations
 * POST /api/it/sync/configs — create/update sync configuration
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
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

export const GET = withAuth(async () => {
  const configs = await (prisma.iTSyncConfig.findMany as Function)({
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

  return NextResponse.json(ok(configs))
}, { permission: PERMISSIONS.IT_ROSTER_CONFIGURE })

export const POST = withAuth(async ({ req, orgId }) => {
  const body = await req.json()
  const validated = UpsertSyncConfigSchema.parse(body)

  const config = await (prisma.iTSyncConfig.upsert as Function)({
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

  return NextResponse.json(ok(config))
}, { permission: PERMISSIONS.IT_ROSTER_CONFIGURE })
