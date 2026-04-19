import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const CreateEscalationSchema = z.object({
  module: z.enum(['MAINTENANCE', 'IT']),
  triggerMins: z.number().int().min(1),
  action: z.enum(['BUMP_PRIORITY', 'REASSIGN', 'NOTIFY_ADMIN']),
  targetPriority: z.string().optional().nullable(),
  targetUserId: z.string().optional().nullable(),
})

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const module = searchParams.get('module')

  const where: Record<string, unknown> = { organizationId: orgId }
  if (module && ['MAINTENANCE', 'IT'].includes(module)) {
    where.module = module
  }

  const rules = await prisma.escalationRule.findMany({
    where,
    include: {
      targetUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { triggerMins: 'asc' },
  })

  return NextResponse.json(ok(rules))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const POST = withAuth<z.infer<typeof CreateEscalationSchema>>(async ({ orgId, body }) => {
  const { module, triggerMins, action, targetPriority, targetUserId } = body

  if (action === 'BUMP_PRIORITY' && !targetPriority) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'Target priority required'), { status: 400 })
  }
  if (action === 'REASSIGN' && !targetUserId) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'Target user required'), { status: 400 })
  }

  const rule = await prisma.escalationRule.create({
    data: {
      organizationId: orgId,
      module,
      triggerMins,
      action,
      targetPriority: action === 'BUMP_PRIORITY' ? targetPriority : null,
      targetUserId: action === 'REASSIGN' ? targetUserId : null,
    },
    include: {
      targetUser: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  return NextResponse.json(ok(rule), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateEscalationSchema })

export const DELETE = withAuth(async ({ orgId, searchParams }) => {
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'id required'), { status: 400 })
  }

  await prisma.escalationRule.delete({ where: { id } })
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
