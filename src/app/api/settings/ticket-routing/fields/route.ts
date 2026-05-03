import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

const BulkUpdateSchema = z.object({
  module: z.enum(['MAINTENANCE', 'IT']),
  categoryKey: z.string().min(1),
  fields: z.array(z.object({
    fieldType: z.enum([
      'ASSET_PICKER', 'AFFECTED_USER', 'URGENCY_JUSTIFICATION',
      'SAFETY_HAZARD', 'DEVICE_TYPE', 'PEOPLE_AFFECTED',
    ]),
    required: z.boolean().default(false),
    sortOrder: z.number().int().min(0).default(0),
  })),
})

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const moduleParam = searchParams.get('module')
  const categoryKey = searchParams.get('categoryKey')

  if (!moduleParam || !['MAINTENANCE', 'IT'].includes(moduleParam)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'moduleParam query param required'),
      { status: 400 }
    )
  }

  const where: Record<string, unknown> = {
    organizationId: orgId,
    moduleParam,
  }
  if (categoryKey) where.categoryKey = categoryKey

  const configs = await prisma.categoryFieldConfig.findMany({
    where,
    orderBy: [{ categoryKey: 'asc' }, { sortOrder: 'asc' }],
  })

  return NextResponse.json(ok(configs))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PUT = withAuth<z.infer<typeof BulkUpdateSchema>>(async ({ orgId, body }) => {
  const { moduleParam, categoryKey, fields } = body

  // Delete all existing field configs for this category, then recreate
  await rawPrisma.categoryFieldConfig.deleteMany({
    where: {
      organizationId: orgId,
      moduleParam,
      categoryKey,
    },
  })

  if (fields.length > 0) {
    await rawPrisma.categoryFieldConfig.createMany({
      data: fields.map((f) => ({
        organizationId: orgId,
        moduleParam,
        categoryKey,
        fieldType: f.fieldType,
        required: f.required,
        sortOrder: f.sortOrder,
      })),
    })
  }

  // Fetch and return the new state
  const updated = await rawPrisma.categoryFieldConfig.findMany({
    where: { organizationId: orgId, moduleParam, categoryKey },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: BulkUpdateSchema })
