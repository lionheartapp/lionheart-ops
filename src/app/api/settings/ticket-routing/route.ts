import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const UpsertRoutingConfigSchema = z.object({
  module: z.enum(['MAINTENANCE', 'IT']),
  schoolId: z.string().nullable().optional(),
  strategy: z.enum(['UNASSIGNED', 'ROUND_ROBIN', 'LOAD_BALANCED', 'MANAGER_TRIAGE']),
  managerUserId: z.string().nullable().optional(),
})

export const GET = withAuth(async ({ orgId }) => {
  const configs = await prisma.moduleRoutingConfig.findMany({
    where: { organizationId: orgId },
    include: {
      school: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ module: 'asc' }, { schoolId: 'asc' }],
  })

  return NextResponse.json(ok(configs))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const POST = withAuth<z.infer<typeof UpsertRoutingConfigSchema>>(async ({ orgId, body }) => {
  const { module, schoolId, strategy, managerUserId } = body

  // CR-011: verify any caller-supplied managerUserId / schoolId belong to the
  // current org before persisting. Without these checks, an admin could pin
  // another org's user as the triage manager (or another org's school as the
  // routing target), corrupting downstream routing semantics.
  if (managerUserId) {
    const manager = await prisma.user.findFirst({
      where: { id: managerUserId, organizationId: orgId },
      select: { id: true },
    })
    if (!manager) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'Selected manager is not a member of this organization'),
        { status: 400 }
      )
    }
  }
  if (schoolId) {
    const school = await prisma.school.findFirst({
      where: { id: schoolId, organizationId: orgId },
      select: { id: true },
    })
    if (!school) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'Selected school does not belong to this organization'),
        { status: 400 }
      )
    }
  }

  // Manager can be set after selecting the strategy — don't block the switch

  // Upsert — schoolId can be null (org-wide default)
  // Can't use prisma upsert with nullable unique, so use findFirst + create/update
  const existing = await rawPrisma.moduleRoutingConfig.findFirst({
    where: { organizationId: orgId, module, schoolId: schoolId ?? null },
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
          school: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      })
    : await rawPrisma.moduleRoutingConfig.create({
        data: {
          organizationId: orgId,
          module,
          schoolId: schoolId ?? null,
          ...data,
        },
        include: {
          school: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      })

  return NextResponse.json(ok(config))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpsertRoutingConfigSchema })
