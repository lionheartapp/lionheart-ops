/**
 * Sync ITERateForm471 from USAC's "E-Rate Form 471 Basic Information"
 * dataset (id: 9s6i-myen). One application number per row.
 *
 * Filters by BEN. Upserts on (organizationId, applicationNumber).
 */

import { rawPrisma, type PrismaDelegate } from '@/lib/db'
import { fetchUsacDataset, whereBen } from './usac-client'
import { ERATE_DATASETS } from './datasets'
import {
  pickBen,
  pickDate,
  pickDecimal,
  pickFundingYear,
  pickInt,
  pickString,
  type Raw,
} from './utils'

export interface Form471SyncResult {
  rowsFetched: number
  rowsUpserted: number
}

export async function syncForm471ForBen(
  organizationId: string,
  ben: string
): Promise<Form471SyncResult> {
  const dataset = ERATE_DATASETS.form471Basic
  const { rows } = await fetchUsacDataset<Raw>(dataset, {
    where: whereBen(ben, 'epc_organization_id'),
    maxRows: 5_000,
  })

  const entities = await (rawPrisma.iTERateEntity as unknown as PrismaDelegate).findMany({
    where: { organizationId },
    select: { id: true, ben: true },
  })
  const entityIdByBen = new Map<string, string>(
    entities.map((e: { id: string; ben: string }) => [e.ben, e.id])
  )

  let upserted = 0
  for (const record of rows) {
    const applicationNumber = pickString(
      record,
      'application_number',
      'form_471_application_number',
      'app_number'
    )
    if (!applicationNumber) continue

    const recordBen = pickBen(record) ?? ben
    const fundingYear = pickFundingYear(record)
    if (!fundingYear) continue

    const data = {
      organizationId,
      applicationNumber,
      ben: recordBen,
      fundingYear,
      applicantEntityId: entityIdByBen.get(recordBen) ?? null,
      nickname: pickString(record, 'nickname', 'application_nickname'),
      status: pickString(record, 'form_471_status_name', 'application_status', 'status'),
      certifiedDate: pickDate(record, 'certified_datetime', 'certified_date_time', 'certified_date'),
      totalPreDiscount: pickDecimal(
        record,
        'pre_discount_eligible_amount',
        'total_pre_discount_amount',
        'pre_discount_amount'
      ),
      totalDiscount: pickDecimal(record, 'funding_request_amount', 'total_discount_amount', 'discount_amount'),
      discountPercent: pickInt(record, 'c1_discount', 'discount_percent', 'discount_pct'),
      rawRecord: record as object,
      lastSyncedAt: new Date(),
    }

    await (rawPrisma.iTERateForm471 as unknown as PrismaDelegate).upsert({
      where: {
        organizationId_applicationNumber: {
          organizationId,
          applicationNumber,
        },
      },
      update: {
        ben: data.ben,
        fundingYear: data.fundingYear,
        applicantEntityId: data.applicantEntityId,
        nickname: data.nickname,
        status: data.status,
        certifiedDate: data.certifiedDate,
        totalPreDiscount: data.totalPreDiscount,
        totalDiscount: data.totalDiscount,
        discountPercent: data.discountPercent,
        rawRecord: data.rawRecord,
        lastSyncedAt: data.lastSyncedAt,
      },
      create: data,
    })
    upserted++
  }

  return { rowsFetched: rows.length, rowsUpserted: upserted }
}
