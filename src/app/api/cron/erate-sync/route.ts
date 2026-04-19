/**
 * POST /api/cron/erate-sync — daily refresh of USAC Open Data for every org
 * with a configured E-Rate entity.
 *
 * Auth: shared CRON_SECRET, identical to the other cron routes.
 *
 * Per org we sync the primary BEN through the standard onboarding dataset
 * subset. To avoid hammering Socrata when there are many orgs, we sync
 * sequentially with a small delay between orgs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma, type PrismaDelegate } from '@/lib/db'
import { syncBen } from '@/lib/services/it/erate-sync'
import { logger } from '@/lib/logger'

const log = logger.child({ route: 'cron/erate-sync' })

/** Pause between orgs so we don't burst Socrata. */
const PER_ORG_DELAY_MS = 250

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface PerOrgSummary {
  organizationId: string
  ben: string
  status: 'success' | 'partial' | 'error'
  datasets: Array<{
    datasetId: string
    status: 'success' | 'error'
    rowsUpserted: number
    errorMessage?: string
  }>
  errorMessage?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret =
    req.headers.get('x-cron-secret') ||
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  try {
    const primaries = (await (
      rawPrisma.iTERateEntity as unknown as PrismaDelegate
    ).findMany({
      where: { isPrimary: true },
      select: { organizationId: true, ben: true },
    })) as Array<{ organizationId: string; ben: string }>

    const summaries: PerOrgSummary[] = []
    let okCount = 0
    let errCount = 0

    for (const { organizationId, ben } of primaries) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await syncBen(organizationId, ben)
        const datasetSummaries = result.datasets.map((d) => ({
          datasetId: d.datasetId,
          status: d.status,
          rowsUpserted: d.rowsUpserted,
          errorMessage: d.errorMessage,
        }))
        const anyError = datasetSummaries.some((d) => d.status === 'error')
        const allError = datasetSummaries.every((d) => d.status === 'error')
        const status: 'success' | 'partial' | 'error' = allError
          ? 'error'
          : anyError
            ? 'partial'
            : 'success'
        if (status === 'error') errCount++
        else okCount++
        summaries.push({ organizationId, ben, status, datasets: datasetSummaries })
      } catch (error: unknown) {
        errCount++
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.error({ err: errorMessage, organizationId, ben }, 'erate-sync org failed')
        summaries.push({
          organizationId,
          ben,
          status: 'error',
          datasets: [],
          errorMessage,
        })
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(PER_ORG_DELAY_MS)
    }

    return NextResponse.json(
      ok({
        totalOrgs: primaries.length,
        okCount,
        errCount,
        summaries,
      })
    )
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error({ err: errorMessage }, 'erate-sync cron failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Cron failed'), { status: 500 })
  }
}
