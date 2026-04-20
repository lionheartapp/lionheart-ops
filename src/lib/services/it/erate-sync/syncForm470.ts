/**
 * Sync ITERateForm470 from USAC's "E-Rate Form 470 Basic Information"
 * dataset (id: jp7a-89nd). One application number per row.
 *
 * Filters by BEN. Upserts on (organizationId, applicationNumber).
 */

import { rawPrisma, type PrismaDelegate } from '@/lib/db'
import { fetchUsacDataset, whereBen } from './usac-client'
import { ERATE_DATASETS } from './datasets'
import {
  addDays,
  pickBen,
  pickDate,
  pickFundingYear,
  pickString,
  type Raw,
} from './utils'

const ALLOWABLE_CONTRACT_DAYS = 28

export interface Form470SyncResult {
  rowsFetched: number
  rowsUpserted: number
}

export async function syncForm470ForBen(
  organizationId: string,
  ben: string
): Promise<Form470SyncResult> {
  const dataset = ERATE_DATASETS.form470Basic
  const { rows } = await fetchUsacDataset<Raw>(dataset, {
    where: whereBen(ben),
    maxRows: 5_000,
  })

  // Look up entities so we can wire up applicantEntityId where possible.
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
      'form_470_application_number',
      'app_number'
    )
    if (!applicationNumber) continue

    const recordBen = pickBen(record) ?? ben
    const fundingYear = pickFundingYear(record)
    if (!fundingYear) continue

    const certifiedDate = pickDate(record, 'certified_datetime', 'certified_date_time', 'certified_date')
    const allowableContractDate =
      pickDate(record, 'allowable_contract_date') ?? addDays(certifiedDate, ALLOWABLE_CONTRACT_DAYS)

    const data = {
      organizationId,
      applicationNumber,
      ben: recordBen,
      fundingYear,
      applicantEntityId: entityIdByBen.get(recordBen) ?? null,
      nickname: pickString(record, 'nickname', 'application_nickname'),
      certifiedDate,
      allowableContractDate,
      contractAwardDate: pickDate(record, 'contract_award_date'),
      category: pickString(record, 'category_of_service', 'category'),
      servicesRequested: null as object | null,
      rawRecord: record as object,
      lastSyncedAt: new Date(),
    }

    await (rawPrisma.iTERateForm470 as unknown as PrismaDelegate).upsert({
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
        certifiedDate: data.certifiedDate,
        allowableContractDate: data.allowableContractDate,
        contractAwardDate: data.contractAwardDate,
        category: data.category,
        rawRecord: data.rawRecord,
        lastSyncedAt: data.lastSyncedAt,
      },
      create: data,
    })
    upserted++
  }

  return { rowsFetched: rows.length, rowsUpserted: upserted }
}
