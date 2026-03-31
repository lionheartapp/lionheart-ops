import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
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

export const GET = withAuth(async ({ params }) => {
  const configs = await getSportStatConfigs(params.id)
  return NextResponse.json(ok(configs))
}, { permission: PERMISSIONS.ATHLETICS_READ })

export const PUT = withAuth(async ({ params, body }) => {
  // Delete removed configs
  if (body.deleteIds?.length) {
    for (const id of body.deleteIds) {
      await deleteSportStatConfig(id)
    }
  }

  // Upsert configs
  const results = []
  for (const cfg of body.configs) {
    results.push(await upsertSportStatConfig({ sportId: params.id, ...cfg }))
  }

  return NextResponse.json(ok(results))
}, { permission: PERMISSIONS.ATHLETICS_MANAGE, schema: UpsertSchema })
