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
    where: whereBen(ben, 'billed_entity_number'),
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

  const upserted = await rawPrisma.$transaction(
    async (tx: typeof rawPrisma) => {
      let count = 0
      for (const record of rows) {
        const frnNumber = pickString(record, 'funding_request_number', 'frn', 'frn_number')
        if (!frnNumber) continue

        const recordBen = pickBen(record) ?? ben
        const fundingYear = pickFundingYear(record)
        if (!fundingYear) continue

        const invoiceNumber = pickString(record, 'invoice_id', 'invoice_number')
        const invoiceDate = pickDate(record, 'inv_received_date', 'invoice_date', 'invoice_received_date')
        const disbursedAmount = pickDecimal(record, 'approved_inv_line_amt', 'disbursed_amount', 'amount_paid')

        const baseData = {
          organizationId,
          frnId: frnIdByNumber.get(frnNumber) ?? null,
          frnNumber,
          ben: recordBen,
          fundingYear,
          invoiceType: pickString(record, 'invoice_type', 'form_type'),
          invoiceNumber,
          invoiceDate,
          authorizedAmount: pickDecimal(record, 'requested_inv_line_amt', 'authorized_amount', 'approved_amount'),
          disbursedAmount,
          paymentDate: pickDate(record, 'customer_billed_dt', 'payment_date', 'paid_date'),
          spin: pickString(record, 'inv_service_provider_id_number_spin', 'spin', 'service_provider_id'),
          serviceProviderName: pickString(record, 'inv_service_provider_name', 'service_provider_name', 'spin_name'),
          rawRecord: record as object,
          lastSyncedAt: new Date(),
        }

        const existing = await (tx.iTERateDisbursement as unknown as PrismaDelegate).findFirst({
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
          await (tx.iTERateDisbursement as unknown as PrismaDelegate).update({
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
          await (tx.iTERateDisbursement as unknown as PrismaDelegate).create({
            data: baseData,
          })
        }
        count++
      }
      return count
    },
    { timeout: 120_000 }
  )

  return { rowsFetched: rows.length, rowsUpserted: upserted }
}
