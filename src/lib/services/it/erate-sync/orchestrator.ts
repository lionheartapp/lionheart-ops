/**
 * E-Rate sync orchestrator.
 *
 * For each onboarding dataset, runs the right sync module under a fresh
 * ITERateSyncRun audit record. After all per-dataset syncs complete, recomputes
 * ITERateFundingYear rollups from the now-current FRN/disbursement rows.
 *
 * Designed to be called from:
 *   - the onboarding flow (right after a user enters their BEN)
 *   - the cron route at /api/cron/erate-sync (daily refresh for active orgs)
 *   - an explicit "Refresh USAC data" button in settings
 */

import { rawPrisma, type PrismaDelegate } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ERATE_DATASETS, ONBOARDING_DATASETS, type ErateDatasetKey } from './datasets'
import { syncEntityForBen } from './syncEntity'
import { syncForm470ForBen } from './syncForm470'
import { syncForm471ForBen } from './syncForm471'
import { syncFrnsForBen } from './syncFRN'
import { syncDisbursementsForBen } from './syncDisbursements'

const log = logger.child({ service: 'erate-orchestrator' })

export interface DatasetRunResult {
  datasetKey: ErateDatasetKey
  datasetId: string
  status: 'success' | 'error'
  rowsFetched: number
  rowsUpserted: number
  durationMs: number
  errorMessage?: string
}

export interface OrchestratorResult {
  organizationId: string
  ben: string
  startedAt: Date
  finishedAt: Date
  datasets: DatasetRunResult[]
  rollupRows: number
}

interface SyncFn {
  (organizationId: string, ben: string): Promise<{ rowsFetched: number; rowsUpserted: number }>
}

/** Map dataset key → sync implementation. Datasets without an implementation are skipped. */
const SYNC_IMPLEMENTATIONS: Partial<Record<ErateDatasetKey, SyncFn>> = {
  entitySupplemental: syncEntityForBen,
  form470Basic: syncForm470ForBen,
  form471Basic: syncForm471ForBen,
  frnStatusFy2016Plus: syncFrnsForBen,
  invoicesAndDisbursements: syncDisbursementsForBen,
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

async function runOneDataset(
  organizationId: string,
  ben: string,
  datasetKey: ErateDatasetKey
): Promise<DatasetRunResult> {
  const dataset = ERATE_DATASETS[datasetKey]
  const fn = SYNC_IMPLEMENTATIONS[datasetKey]
  const startedAt = new Date()

  // Open audit row first so we can record errors.
  const run = (await (
    rawPrisma.iTERateSyncRun as unknown as PrismaDelegate
  ).create({
    data: {
      organizationId,
      ben,
      datasetId: dataset.id,
      datasetLabel: dataset.label,
      startedAt,
      status: 'running',
    },
  })) as { id: string }

  if (!fn) {
    await (rawPrisma.iTERateSyncRun as unknown as PrismaDelegate).update({
      where: { id: run.id },
      data: {
        status: 'error',
        finishedAt: new Date(),
        errorMessage: 'No sync implementation for this dataset',
      },
    })
    return {
      datasetKey,
      datasetId: dataset.id,
      status: 'error',
      rowsFetched: 0,
      rowsUpserted: 0,
      durationMs: Date.now() - startedAt.getTime(),
      errorMessage: 'No sync implementation for this dataset',
    }
  }

  try {
    const { rowsFetched, rowsUpserted } = await fn(organizationId, ben)
    const finishedAt = new Date()
    await (rawPrisma.iTERateSyncRun as unknown as PrismaDelegate).update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt,
        rowsFetched,
        rowsUpserted,
      },
    })
    return {
      datasetKey,
      datasetId: dataset.id,
      status: 'success',
      rowsFetched,
      rowsUpserted,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    }
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error)
    log.error(
      { err: errorMessage, datasetId: dataset.id, organizationId, ben },
      `E-Rate sync failed: ${dataset.label}`
    )
    await (rawPrisma.iTERateSyncRun as unknown as PrismaDelegate).update({
      where: { id: run.id },
      data: {
        status: 'error',
        finishedAt: new Date(),
        errorMessage: errorMessage.slice(0, 500),
      },
    })
    return {
      datasetKey,
      datasetId: dataset.id,
      status: 'error',
      rowsFetched: 0,
      rowsUpserted: 0,
      durationMs: Date.now() - startedAt.getTime(),
      errorMessage,
    }
  }
}

/**
 * Recompute ITERateFundingYear rollups from the FRN + disbursement tables.
 * Idempotent — safe to call after every sync.
 */
async function rebuildFundingYearRollups(organizationId: string, ben: string): Promise<number> {
  const frns = (await (rawPrisma.iTERateFRN as unknown as PrismaDelegate).findMany({
    where: { organizationId, ben },
    select: {
      fundingYear: true,
      preDiscountAmount: true,
      committedAmount: true,
      disbursedAmount: true,
      serviceCategory: true,
      invoiceDeadline: true,
      status: true,
    },
  })) as Array<{
    fundingYear: number
    preDiscountAmount: { toNumber(): number } | number | null
    committedAmount: { toNumber(): number } | number | null
    disbursedAmount: { toNumber(): number } | number | null
    serviceCategory: string | null
    invoiceDeadline: Date | null
    status: string | null
  }>

  const toNumber = (v: { toNumber(): number } | number | null): number => {
    if (v === null || v === undefined) return 0
    if (typeof v === 'number') return v
    return v.toNumber()
  }

  // Group FRNs by funding year.
  const byYear = new Map<
    number,
    {
      requested: number
      committed: number
      disbursed: number
      cat1Committed: number
      cat2Committed: number
      earliestInvoiceDeadline: Date | null
      anyCommitted: boolean
      anyDisbursed: boolean
    }
  >()

  for (const f of frns) {
    const bucket = byYear.get(f.fundingYear) ?? {
      requested: 0,
      committed: 0,
      disbursed: 0,
      cat1Committed: 0,
      cat2Committed: 0,
      earliestInvoiceDeadline: null as Date | null,
      anyCommitted: false,
      anyDisbursed: false,
    }
    const requested = toNumber(f.preDiscountAmount)
    const committed = toNumber(f.committedAmount)
    const disbursed = toNumber(f.disbursedAmount)
    bucket.requested += requested
    bucket.committed += committed
    bucket.disbursed += disbursed
    if (committed > 0) bucket.anyCommitted = true
    if (disbursed > 0) bucket.anyDisbursed = true
    if (f.serviceCategory && f.serviceCategory.toLowerCase().includes('1')) {
      bucket.cat1Committed += committed
    } else if (f.serviceCategory && f.serviceCategory.toLowerCase().includes('2')) {
      bucket.cat2Committed += committed
    }
    if (f.invoiceDeadline) {
      if (
        bucket.earliestInvoiceDeadline === null ||
        f.invoiceDeadline.getTime() < bucket.earliestInvoiceDeadline.getTime()
      ) {
        bucket.earliestInvoiceDeadline = f.invoiceDeadline
      }
    }
    byYear.set(f.fundingYear, bucket)
  }

  let rolledUp = 0
  for (const [fundingYear, bucket] of byYear) {
    const status = bucket.anyDisbursed
      ? 'Funded'
      : bucket.anyCommitted
        ? 'Committed'
        : 'Filed'

    await (rawPrisma.iTERateFundingYear as unknown as PrismaDelegate).upsert({
      where: {
        organizationId_ben_fundingYear: {
          organizationId,
          ben,
          fundingYear,
        },
      },
      update: {
        totalRequested: bucket.requested,
        totalCommitted: bucket.committed,
        totalDisbursed: bucket.disbursed,
        category1Committed: bucket.cat1Committed,
        category2Committed: bucket.cat2Committed,
        applicationStatus: status,
        invoiceDeadline: bucket.earliestInvoiceDeadline,
        lastSyncedAt: new Date(),
      },
      create: {
        organizationId,
        ben,
        fundingYear,
        totalRequested: bucket.requested,
        totalCommitted: bucket.committed,
        totalDisbursed: bucket.disbursed,
        category1Committed: bucket.cat1Committed,
        category2Committed: bucket.cat2Committed,
        applicationStatus: status,
        invoiceDeadline: bucket.earliestInvoiceDeadline,
        lastSyncedAt: new Date(),
      },
    })
    rolledUp++
  }

  return rolledUp
}

/**
 * Sync a single BEN end-to-end. The default dataset list is the onboarding
 * subset; pass `datasets` to override (for example, the cron may sync more
 * aggressively).
 */
export async function syncBen(
  organizationId: string,
  ben: string,
  datasets: ErateDatasetKey[] = ONBOARDING_DATASETS
): Promise<OrchestratorResult> {
  const startedAt = new Date()
  const results: DatasetRunResult[] = []
  for (const key of datasets) {
    // Run sequentially — Socrata is generous but this also keeps DB writes
    // ordered (entities → forms → FRNs → disbursements) so FK back-fills work.
    // eslint-disable-next-line no-await-in-loop
    results.push(await runOneDataset(organizationId, ben, key))
  }

  const rollupRows = await rebuildFundingYearRollups(organizationId, ben)
  const finishedAt = new Date()

  return {
    organizationId,
    ben,
    startedAt,
    finishedAt,
    datasets: results,
    rollupRows,
  }
}
