/**
 * GET  /api/it/erate/entities — list ITERateEntity rows for the current org.
 * POST /api/it/erate/entities — declare a new BEN as the org's primary entity.
 *
 * The POST flow is what onboarding hits when the user enters their BEN. It
 * creates a placeholder ITERateEntity (filled in lazily by the next sync run)
 * and marks it primary. If the user re-submits a different BEN, the previous
 * primary is demoted.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma, type PrismaDelegate } from '@/lib/db'

const CreateEntitySchema = z.object({
  ben: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, 'BEN must be a numeric Billed Entity Number'),
  entityName: z.string().trim().min(1).max(255).optional(),
  isPrimary: z.boolean().optional(),
})

type CreateEntityInput = z.infer<typeof CreateEntitySchema>

export const GET = withAuth(
  async ({ orgId }) => {
    const entities = await (rawPrisma.iTERateEntity as unknown as PrismaDelegate).findMany({
      where: { organizationId: orgId },
      orderBy: [{ isPrimary: 'desc' }, { ben: 'asc' }],
    })
    return NextResponse.json(ok(entities))
  },
  { permission: PERMISSIONS.IT_ERATE_VIEW }
)

export const POST = withAuth<CreateEntityInput>(
  async ({ orgId, body }) => {
    const isPrimary = body.isPrimary !== false // default true

    if (isPrimary) {
      // Demote any other primary entities first.
      await (rawPrisma.iTERateEntity as unknown as PrismaDelegate).updateMany({
        where: { organizationId: orgId, isPrimary: true, ben: { not: body.ben } },
        data: { isPrimary: false },
      })
    }

    const entity = await (rawPrisma.iTERateEntity as unknown as PrismaDelegate).upsert({
      where: { organizationId_ben: { organizationId: orgId, ben: body.ben } },
      update: {
        isPrimary,
        ...(body.entityName ? { entityName: body.entityName } : {}),
      },
      create: {
        organizationId: orgId,
        ben: body.ben,
        entityName: body.entityName ?? `BEN ${body.ben}`,
        isPrimary,
      },
    })

    return NextResponse.json(ok(entity), { status: 201 })
  },
  { permission: PERMISSIONS.IT_ERATE_MANAGE, schema: CreateEntitySchema }
)
