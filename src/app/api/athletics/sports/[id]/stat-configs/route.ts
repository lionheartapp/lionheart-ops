import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getSportStatConfigs, upsertSportStatConfig, deleteSportStatConfig } from '@/lib/services/athleticsService'

const UpsertSchema = z.object({
  configs: z.array(z.object({
    statKey: z.string().min(1),
    label: z.string().min(1),
    sortOrder: z.number().int().optional(),
  })),
  deleteIds: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)
    const { id: sportId } = await params

    return await runWithOrgContext(orgId, async () => {
      const configs = await getSportStatConfigs(sportId)
      return NextResponse.json(ok(configs))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch stat configs'), { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_MANAGE)
    const { id: sportId } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = UpsertSchema.parse(body)

      // Delete removed configs
      if (input.deleteIds?.length) {
        for (const id of input.deleteIds) {
          await deleteSportStatConfig(id)
        }
      }

      // Upsert configs
      const results = []
      for (const cfg of input.configs) {
        results.push(await upsertSportStatConfig({ sportId, ...cfg }))
      }

      return NextResponse.json(ok(results))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update stat configs'), { status: 500 })
  }
}
