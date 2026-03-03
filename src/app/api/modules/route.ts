import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
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
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch modules'), { status: 500 })
  }
}

const ToggleModuleSchema = z.object({
  moduleId: z.string().min(1),
  enabled: z.boolean(),
  campusId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()

    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const input = ToggleModuleSchema.parse(body)
      const db = prisma as any

      if (input.enabled) {
        const mod = await db.tenantModule.upsert({
          where: {
            organizationId_moduleId_campusId: {
              organizationId: orgId,
              moduleId: input.moduleId,
              campusId: input.campusId ?? null,
            },
          },
          create: {
            organizationId: orgId,
            moduleId: input.moduleId,
            campusId: input.campusId ?? null,
          },
          update: {},
        })
        return NextResponse.json(ok(mod), { status: 200 })
      } else {
        await db.tenantModule.deleteMany({
          where: {
            organizationId: orgId,
            moduleId: input.moduleId,
            campusId: input.campusId ?? null,
          },
        })
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
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to toggle module'), { status: 500 })
  }
}
