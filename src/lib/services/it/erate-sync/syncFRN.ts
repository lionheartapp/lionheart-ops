/**
 * Sync ITERateFRN from USAC's "E-Rate FRN Status Tool FY2016+" dataset
 * (id: 8xzh-ytkh). One FRN per row.
 *
 * Filters by BEN. Upserts on (organizationId, frnNumber).
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

export interface FrnSyncResult {
  rowsFetched: number
  rowsUpserted: number
}

export async function syncFrnsForBen(
  organizationId: string,
  ben: string
): Promise<FrnSyncResult> {
  const dataset = ERATE_DATASETS.form471FrnStatus
  const { rows } = await fetchUsacDataset<Raw>(dataset, {
    where: whereBen(ben),
    maxRows: 20_000,
  })

  // Look up parent 471 ids for back-fill (form471Id is optional but useful).
  const form471s = await (rawPrisma.iTERateForm471 as unknown as PrismaDelegate).findMany({
    where: { organizationId },
    select: { id: true, applicationNumber: true },
  })
  const form471IdByApp = new Map<string, string>(
    form471s.map((f: { id: string; applicationNumber: string }) => [f.applicationNumber, f.id])
  )

  const upserted = await rawPrisma.$transaction(
    async (tx) => {
      let count = 0
      for (const record of rows) {
        const frnNumber = pickString(record, 'frn', 'frn_number', 'funding_request_number')
        if (!frnNumber) continue

        const applicationNumber = pickString(
          record,
          'application_number',
          'form_471_application_number'
        )
        if (!applicationNumber) continue

        const recordBen = pickBen(record) ?? ben
        const fundingYear = pickFundingYear(record)
        if (!fundingYear) continue

        const data = {
          organizationId,
          frnNumber,
          form471Id: form471IdByApp.get(applicationNumber) ?? null,
          applicationNumber,
          ben: recordBen,
          fundingYear,
          serviceType: pickString(record, 'form_471_service_type_name', 'service_type', 'service_type_name'),
          serviceCategory: pickString(record, 'chosen_category_of_service', 'service_category', 'category_of_service'),
          spin: pickString(record, 'spin', 'service_provider_id', 'spin_number'),
          serviceProviderName: pickString(
            record,
            'spin_name',
            'service_provider_name',
            'provider_name'
          ),
          contractNumber: pickString(record, 'contract_number', 'master_contract_number'),
          preDiscountAmount: pickDecimal(record, 'total_pre_discount_costs', 'pre_discount_amount', 'pre_discount'),
          discountAmount: pickDecimal(record, 'dis_pct', 'discount_amount'),
          committedAmount: pickDecimal(record, 'funding_commitment_request', 'committed_amount', 'commitment_amount'),
          disbursedAmount: pickDecimal(record, 'total_authorized_disbursement', 'disbursed_amount', 'total_disbursement'),
          status: pickString(record, 'form_471_frn_status_name', 'frn_status', 'status', 'application_status'),
          fcdlDate: pickDate(record, 'fcdl_letter_date', 'fcdl_date', 'commitment_letter_date'),
          invoiceDeadline: pickDate(record, 'last_date_to_invoke', 'invoice_deadline_date', 'invoice_deadline'),
          rawRecord: record as object,
          lastSyncedAt: new Date(),
        }

        await (tx.iTERateFRN as unknown as PrismaDelegate).upsert({
          where: {
            organizationId_frnNumber: { organizationId, frnNumber },
          },
          update: {
            form471Id: data.form471Id,
            applicationNumber: data.applicationNumber,
            ben: data.ben,
            fundingYear: data.fundingYear,
            serviceType: data.serviceType,
            serviceCategory: data.serviceCategory,
            spin: data.spin,
            serviceProviderName: data.serviceProviderName,
            contractNumber: data.contractNumber,
            preDiscountAmount: data.preDiscountAmount,
            discountAmount: data.discountAmount,
            committedAmount: data.committedAmount,
            disbursedAmount: data.disbursedAmount,
            status: data.status,
            fcdlDate: data.fcdlDate,
            invoiceDeadline: data.invoiceDeadline,
            rawRecord: data.rawRecord,
            lastSyncedAt: data.lastSyncedAt,
          },
          create: data,
        })
        count++
      }
      return count
    },
    { timeout: 120_000 }
  )

  return { rowsFetched: rows.length, rowsUpserted: upserted }
}
