/**
 * POST /api/it/erate/sync — kick off a USAC Open Data sync for one BEN.
 *
 * The BEN can come from the request body (during onboarding) or, if omitted,
 * from the org's primary ITERateEntity row.
 *
 * Returns the OrchestratorResult so the UI can render per-dataset success
 * and surface any errors immediately. The work runs synchronously inside the
 * request — it is fast (a few thousand rows max per dataset) and the user
 * is staring at a "syncing…" spinner during onboarding.
 *
 * GET /api/it/erate/sync — list recent sync runs (latest per dataset).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma, type PrismaDelegate } from '@/lib/db'
import { syncBen, getLatestSyncRuns } from '@/lib/services/it/erate-sync'

const SyncRequestSchema = z.object({
  /** BEN to sync. Defaults to the org's primary ITERateEntity. */
  ben: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, 'BEN must be a numeric Billed Entity Number')
    .optional(),
})

type SyncRequest = z.infer<typeof SyncRequestSchema>

async function resolveBen(
  organizationId: string,
  bodyBen: string | undefined
): Promise<string | null> {
  if (bodyBen) return bodyBen

  const primary = (await (rawPrisma.iTERateEntity as unknown as PrismaDelegate).findFirst({
    where: { organizationId, isPrimary: true },
    orderBy: { createdAt: 'asc' },
    select: { ben: true },
  })) as { ben: string } | null

  return primary?.ben ?? null
}

export const POST = withAuth<SyncRequest>(
  async ({ orgId, body }) => {
    const ben = await resolveBen(orgId, body.ben)
    if (!ben) {
      return NextResponse.json(
        fail(
          'BAD_REQUEST',
          'No BEN provided and no primary E-Rate entity is configured for this org.'
        ),
        { status: 400 }
      )
    }

    const result = await syncBen(orgId, ben)
    return NextResponse.json(ok(result))
  },
  { permission: PERMISSIONS.IT_ERATE_SYNC, schema: SyncRequestSchema }
)

export const GET = withAuth(
  async ({ orgId, searchParams }) => {
    const ben = searchParams.get('ben') || undefined
    const runs = await getLatestSyncRuns(orgId, ben)
    return NextResponse.json(ok(runs))
  },
  { permission: PERMISSIONS.IT_ERATE_VIEW }
)
