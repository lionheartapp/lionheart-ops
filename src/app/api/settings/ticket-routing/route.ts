import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const UpsertRoutingConfigSchema = z.object({
  module: z.enum(['MAINTENANCE', 'IT']),
  campusId: z.string().nullable().optional(),
  strategy: z.enum(['UNASSIGNED', 'ROUND_ROBIN', 'LOAD_BALANCED', 'MANAGER_TRIAGE']),
  managerUserId: z.string().nullable().optional(),
})

export const GET = withAuth(async ({ orgId }) => {
  const configs = await prisma.moduleRoutingConfig.findMany({
    where: { organizationId: orgId },
    include: {
      campus: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ module: 'asc' }, { campusId: 'asc' }],
  })

  return NextResponse.json(ok(configs))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const POST = withAuth<z.infer<typeof UpsertRoutingConfigSchema>>(async ({ orgId, body }) => {
  const { module, campusId, strategy, managerUserId } = body

  if (strategy === 'MANAGER_TRIAGE' && !managerUserId) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Manager is required for triage strategy'),
      { status: 400 }
    )
  }

  // Upsert — campusId can be null (org-wide default)
  // Can't use prisma upsert with nullable unique, so use findFirst + create/update
  const existing = await rawPrisma.moduleRoutingConfig.findFirst({
    where: { organizationId: orgId, module, campusId: campusId ?? null },
  })

  const data = {
    strategy,
    managerUserId: strategy === 'MANAGER_TRIAGE' ? managerUserId : null,
  }

  const config = existing
    ? await rawPrisma.moduleRoutingConfig.update({
        where: { id: existing.id },
        data,
        include: {
          campus: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      })
    : await rawPrisma.moduleRoutingConfig.create({
        data: {
          organizationId: orgId,
          module,
          campusId: campusId ?? null,
          ...data,
        },
        include: {
          campus: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      })

  return NextResponse.json(ok(config))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpsertRoutingConfigSchema })
