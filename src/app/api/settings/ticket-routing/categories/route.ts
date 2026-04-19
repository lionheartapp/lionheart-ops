import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const UpdateCategoryConfigSchema = z.object({
  module: z.enum(['MAINTENANCE', 'IT']),
  categoryKey: z.string().min(1),
  specialistUserId: z.string().nullable().optional(),
  fallbackUserId: z.string().nullable().optional(),
  slaResponseMins: z.number().int().min(1).nullable().optional(),
  slaResolveMins: z.number().int().min(1).nullable().optional(),
})

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const module = searchParams.get('module')
  if (!module || !['MAINTENANCE', 'IT'].includes(module)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'module query param required (MAINTENANCE or IT)'),
      { status: 400 }
    )
  }

  const configs = await prisma.routingCategoryConfig.findMany({
    where: {
      organizationId: orgId,
      module: module as 'MAINTENANCE' | 'IT',
    },
    include: {
      specialist: { select: { id: true, firstName: true, lastName: true, email: true } },
      fallback: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { categoryKey: 'asc' },
  })

  return NextResponse.json(ok(configs))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<z.infer<typeof UpdateCategoryConfigSchema>>(async ({ orgId, body }) => {
  const { module, categoryKey, specialistUserId, fallbackUserId, slaResponseMins, slaResolveMins } = body

  const existing = await prisma.routingCategoryConfig.findUnique({
    where: {
      organizationId_module_categoryKey: {
        organizationId: orgId,
        module,
        categoryKey,
      },
    },
  })

  if (!existing) {
    return NextResponse.json(
      fail('NOT_FOUND', `No category config found for ${module}/${categoryKey}`),
      { status: 404 }
    )
  }

  const updated = await prisma.routingCategoryConfig.update({
    where: { id: existing.id },
    data: {
      ...(specialistUserId !== undefined ? { specialistUserId } : {}),
      ...(fallbackUserId !== undefined ? { fallbackUserId } : {}),
      ...(slaResponseMins !== undefined ? { slaResponseMins } : {}),
      ...(slaResolveMins !== undefined ? { slaResolveMins } : {}),
    },
    include: {
      specialist: { select: { id: true, firstName: true, lastName: true, email: true } },
      fallback: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateCategoryConfigSchema })
