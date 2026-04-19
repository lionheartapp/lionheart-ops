/**
 * Sync ITERateDisbursement from USAC's "E-Rate Invoices and Authorized
 * Disbursements (Forms 472/474)" dataset (id: jpiu-tj8h).
 *
 * Filters by BEN. Disbursements have no single natural unique key, so we
 * dedupe on (organizationId, frnNumber, invoiceNumber, invoiceDate,
 * disbursedAmount). When a record matches we update; otherwise we insert.
 */

import { rawPrisma, type PrismaDelegate } from '@/lib/db'
import { fetchUsacDataset, whereBen } from './usac-client'
import { ERATE_DATASETS } from './datasets'
import {
  pickBen,
  pickDate,
  pickDecimal,
  pickFundingYear,
  pickString,
  type Raw,
} from './utils'

export interface DisbursementSyncResult {
  rowsFetched: number
  rowsUpserted: number
}

export async function syncDisbursementsForBen(
  organizationId: string,
  ben: string
): Promise<DisbursementSyncResult> {
  const dataset = ERATE_DATASETS.invoicesAndDisbursements
  const { rows } = await fetchUsacDataset<Raw>(dataset, {
    where: whereBen(ben),
    maxRows: 50_000,
  })

  // Map FRN number → id for FK back-fill.
  const frns = await (rawPrisma.iTERateFRN as unknown as PrismaDelegate).findMany({
    where: { organizationId },
    select: { id: true, frnNumber: true },
  })
  const frnIdByNumber = new Map<string, string>(
    frns.map((f: { id: string; frnNumber: string }) => [f.frnNumber, f.id])
  )

  let upserted = 0
  for (const record of rows) {
    const frnNumber = pickString(record, 'frn', 'frn_number', 'funding_request_number')
    if (!frnNumber) continue

    const recordBen = pickBen(record) ?? ben
    const fundingYear = pickFundingYear(record)
    if (!fundingYear) continue

    const invoiceNumber = pickString(record, 'invoice_number', 'invoice_id')
    const invoiceDate = pickDate(record, 'invoice_date', 'invoice_received_date')
    const disbursedAmount = pickDecimal(record, 'disbursed_amount', 'amount_paid')

    const baseData = {
      organizationId,
      frnId: frnIdByNumber.get(frnNumber) ?? null,
      frnNumber,
      ben: recordBen,
      fundingYear,
      invoiceType: pickString(record, 'invoice_type', 'form_type'),
      invoiceNumber,
      invoiceDate,
      authorizedAmount: pickDecimal(record, 'authorized_amount', 'approved_amount'),
      disbursedAmount,
      paymentDate: pickDate(record, 'payment_date', 'paid_date'),
      spin: pickString(record, 'spin', 'service_provider_id'),
      serviceProviderName: pickString(record, 'service_provider_name', 'spin_name'),
      rawRecord: record as object,
      lastSyncedAt: new Date(),
    }

    // Find an existing row matching the natural key.
    const existing = await (rawPrisma.iTERateDisbursement as unknown as PrismaDelegate).findFirst({
      where: {
        organizationId,
        frnNumber,
        invoiceNumber: invoiceNumber ?? null,
        invoiceDate: invoiceDate ?? null,
        disbursedAmount: disbursedAmount ?? null,
      },
      select: { id: true },
    })

    if (existing) {
      await (rawPrisma.iTERateDisbursement as unknown as PrismaDelegate).update({
        where: { id: existing.id },
        data: {
          frnId: baseData.frnId,
          authorizedAmount: baseData.authorizedAmount,
          paymentDate: baseData.paymentDate,
          spin: baseData.spin,
          serviceProviderName: baseData.serviceProviderName,
          invoiceType: baseData.invoiceType,
          rawRecord: baseData.rawRecord,
          lastSyncedAt: baseData.lastSyncedAt,
        },
      })
    } else {
      await (rawPrisma.iTERateDisbursement as unknown as PrismaDelegate).create({
        data: baseData,
      })
    }
    upserted++
  }

  return { rowsFetched: rows.length, rowsUpserted: upserted }
}
