/**
 * E-Rate USAC Open Data sync — public exports.
 *
 * Public entry points:
 *   - syncBen(organizationId, ben) — run a full onboarding sync
 *   - listFundingYears(organizationId, ben?) — read rolled-up funding-year cards
 *   - listFrns(organizationId, ben?, fundingYear?) — read FRN detail
 *   - listDisbursements(organizationId, frnNumber) — read disbursements for a FRN
 *
 * Lower-level helpers (USAC client, dataset registry, per-dataset modules) are
 * intentionally not re-exported here — callers should import them directly when
 * they need them.
 */

import { rawPrisma, type PrismaDelegate } from '@/lib/db'
import { syncBen, type OrchestratorResult } from './orchestrator'
import { ONBOARDING_DATASETS, ERATE_DATASETS, type ErateDatasetKey } from './datasets'

export { syncBen }
export type { OrchestratorResult, DatasetRunResult } from './orchestrator'
export { ONBOARDING_DATASETS, ERATE_DATASETS }
export type { ErateDatasetKey, UsacDataset } from './datasets'

export interface FundingYearCard {
  fundingYear: number
  ben: string
  applicationStatus: string | null
  totalRequested: number
  totalCommitted: number
  totalDisbursed: number
  category1Committed: number
  category2Committed: number
  invoiceDeadline: Date | null
  lastSyncedAt: Date | null
}

function decimalToNumber(v: { toNumber(): number } | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return v
  return v.toNumber()
}

export async function listFundingYears(
  organizationId: string,
  ben?: string
): Promise<FundingYearCard[]> {
  const rows = (await (
    rawPrisma.iTERateFundingYear as unknown as PrismaDelegate
  ).findMany({
    where: { organizationId, ...(ben ? { ben } : {}) },
    orderBy: [{ fundingYear: 'desc' }],
  })) as Array<{
    fundingYear: number
    ben: string
    applicationStatus: string | null
    totalRequested: { toNumber(): number } | null
    totalCommitted: { toNumber(): number } | null
    totalDisbursed: { toNumber(): number } | null
    category1Committed: { toNumber(): number } | null
    category2Committed: { toNumber(): number } | null
    invoiceDeadline: Date | null
    lastSyncedAt: Date | null
  }>

  return rows.map((r) => ({
    fundingYear: r.fundingYear,
    ben: r.ben,
    applicationStatus: r.applicationStatus,
    totalRequested: decimalToNumber(r.totalRequested),
    totalCommitted: decimalToNumber(r.totalCommitted),
    totalDisbursed: decimalToNumber(r.totalDisbursed),
    category1Committed: decimalToNumber(r.category1Committed),
    category2Committed: decimalToNumber(r.category2Committed),
    invoiceDeadline: r.invoiceDeadline,
    lastSyncedAt: r.lastSyncedAt,
  }))
}

export interface FrnRow {
  frnNumber: string
  applicationNumber: string
  ben: string
  fundingYear: number
  serviceType: string | null
  serviceCategory: string | null
  serviceProviderName: string | null
  contractNumber: string | null
  spin: string | null
  status: string | null
  preDiscountAmount: number
  discountAmount: number
  committedAmount: number
  disbursedAmount: number
  invoiceDeadline: Date | null
  fcdlDate: Date | null
}

export async function listFrns(
  organizationId: string,
  filters: { ben?: string; fundingYear?: number } = {}
): Promise<FrnRow[]> {
  const where: Record<string, unknown> = { organizationId }
  if (filters.ben) where.ben = filters.ben
  if (filters.fundingYear) where.fundingYear = filters.fundingYear

  const rows = (await (rawPrisma.iTERateFRN as unknown as PrismaDelegate).findMany({
    where,
    orderBy: [{ fundingYear: 'desc' }, { frnNumber: 'asc' }],
  })) as Array<{
    frnNumber: string
    applicationNumber: string
    ben: string
    fundingYear: number
    serviceType: string | null
    serviceCategory: string | null
    serviceProviderName: string | null
    contractNumber: string | null
    spin: string | null
    status: string | null
    preDiscountAmount: { toNumber(): number } | null
    discountAmount: { toNumber(): number } | null
    committedAmount: { toNumber(): number } | null
    disbursedAmount: { toNumber(): number } | null
    invoiceDeadline: Date | null
    fcdlDate: Date | null
  }>

  return rows.map((r) => ({
    frnNumber: r.frnNumber,
    applicationNumber: r.applicationNumber,
    ben: r.ben,
    fundingYear: r.fundingYear,
    serviceType: r.serviceType,
    serviceCategory: r.serviceCategory,
    serviceProviderName: r.serviceProviderName,
    contractNumber: r.contractNumber,
    spin: r.spin,
    status: r.status,
    preDiscountAmount: decimalToNumber(r.preDiscountAmount),
    discountAmount: decimalToNumber(r.discountAmount),
    committedAmount: decimalToNumber(r.committedAmount),
    disbursedAmount: decimalToNumber(r.disbursedAmount),
    invoiceDeadline: r.invoiceDeadline,
    fcdlDate: r.fcdlDate,
  }))
}

export interface DisbursementRow {
  invoiceType: string | null
  invoiceNumber: string | null
  invoiceDate: Date | null
  authorizedAmount: number
  disbursedAmount: number
  paymentDate: Date | null
  serviceProviderName: string | null
  spin: string | null
}

export async function listDisbursements(
  organizationId: string,
  frnNumber: string
): Promise<DisbursementRow[]> {
  const rows = (await (
    rawPrisma.iTERateDisbursement as unknown as PrismaDelegate
  ).findMany({
    where: { organizationId, frnNumber },
    orderBy: { invoiceDate: 'desc' },
  })) as Array<{
    invoiceType: string | null
    invoiceNumber: string | null
    invoiceDate: Date | null
    authorizedAmount: { toNumber(): number } | null
    disbursedAmount: { toNumber(): number } | null
    paymentDate: Date | null
    serviceProviderName: string | null
    spin: string | null
  }>

  return rows.map((r) => ({
    invoiceType: r.invoiceType,
    invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate,
    authorizedAmount: decimalToNumber(r.authorizedAmount),
    disbursedAmount: decimalToNumber(r.disbursedAmount),
    paymentDate: r.paymentDate,
    serviceProviderName: r.serviceProviderName,
    spin: r.spin,
  }))
}

export interface EntityRow {
  id: string
  ben: string
  entityName: string
  entityType: string | null
  schoolId: string | null
  schoolName: string | null
  isPrimary: boolean
  state: string | null
  city: string | null
  lastSyncedAt: Date | null
}

export async function listEntities(organizationId: string): Promise<EntityRow[]> {
  const rows = (await (rawPrisma.iTERateEntity as unknown as PrismaDelegate).findMany({
    where: { organizationId },
    include: {
      school: { select: { id: true, name: true } },
    },
    orderBy: [{ isPrimary: 'desc' }, { entityName: 'asc' }],
  })) as Array<{
    id: string
    ben: string
    entityName: string
    entityType: string | null
    schoolId: string | null
    isPrimary: boolean
    state: string | null
    city: string | null
    lastSyncedAt: Date | null
    school: { id: string; name: string } | null
  }>

  return rows.map((r) => ({
    id: r.id,
    ben: r.ben,
    entityName: r.entityName,
    entityType: r.entityType,
    schoolId: r.schoolId,
    schoolName: r.school?.name ?? null,
    isPrimary: r.isPrimary,
    state: r.state,
    city: r.city,
    lastSyncedAt: r.lastSyncedAt,
  }))
}

/** Link an ITERateEntity to a School record. */
export async function linkEntityToSchool(
  organizationId: string,
  entityId: string,
  schoolId: string | null
): Promise<void> {
  await (rawPrisma.iTERateEntity as unknown as PrismaDelegate).update({
    where: { id: entityId },
    data: { schoolId },
  })
}

/**
 * Convenience: get the most recent successful sync run per dataset for a BEN.
 */
export async function getLatestSyncRuns(
  organizationId: string,
  ben?: string
): Promise<
  Array<{
    datasetId: string
    datasetLabel: string
    finishedAt: Date | null
    rowsUpserted: number
    status: string
    errorMessage: string | null
  }>
> {
  const where: Record<string, unknown> = { organizationId }
  if (ben) where.ben = ben

  const rows = (await (
    rawPrisma.iTERateSyncRun as unknown as PrismaDelegate
  ).findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: 100,
  })) as Array<{
    datasetId: string
    datasetLabel: string
    finishedAt: Date | null
    rowsUpserted: number
    status: string
    errorMessage: string | null
  }>

  // Keep only the latest run per dataset.
  const seen = new Set<string>()
  const latest = []
  for (const r of rows) {
    if (seen.has(r.datasetId)) continue
    seen.add(r.datasetId)
    latest.push(r)
  }
  return latest
}
