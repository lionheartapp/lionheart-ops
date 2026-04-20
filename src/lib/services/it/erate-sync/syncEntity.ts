/**
 * Sync ITERateEntity from USAC's "E-Rate Supplemental Entity Information"
 * dataset (id: 7i5i-83qf).
 *
 * Filters by BEN. Upserts on (organizationId, ben).
 */

import { rawPrisma, type PrismaDelegate } from '@/lib/db'
import { fetchUsacDataset, whereBen } from './usac-client'
import { ERATE_DATASETS } from './datasets'
import { pickString, pickBen, type Raw } from './utils'

export interface EntitySyncResult {
  rowsFetched: number
  rowsUpserted: number
}

export async function syncEntityForBen(
  organizationId: string,
  ben: string
): Promise<EntitySyncResult> {
  const dataset = ERATE_DATASETS.entitySupplemental
  const { rows } = await fetchUsacDataset<Raw>(dataset, {
    where: whereBen(ben, 'entity_number'),
    maxRows: 1_000,
  })

  let upserted = 0
  for (const record of rows) {
    const recordBen = pickBen(record)
    if (!recordBen) continue

    const data = {
      organizationId,
      ben: recordBen,
      entityName:
        pickString(record, 'entity_name', 'name', 'organization_name') ?? `BEN ${recordBen}`,
      entityType: pickString(record, 'entity_type', 'entity_type_name'),
      entityTypeCode: pickString(record, 'entity_type_code'),
      parentBen: pickString(record, 'parent_entity_ben', 'parent_ben'),
      state: pickString(record, 'state', 'physical_state', 'state_code'),
      city: pickString(record, 'city', 'physical_city'),
      zipCode: pickString(record, 'zip_code', 'physical_zip', 'zip'),
      isPrimary: recordBen === String(ben),
      rawRecord: record as object,
      lastSyncedAt: new Date(),
    }

    await (rawPrisma.iTERateEntity as unknown as PrismaDelegate).upsert({
      where: {
        organizationId_ben: { organizationId, ben: recordBen },
      },
      update: {
        entityName: data.entityName,
        entityType: data.entityType,
        entityTypeCode: data.entityTypeCode,
        parentBen: data.parentBen,
        state: data.state,
        city: data.city,
        zipCode: data.zipCode,
        rawRecord: data.rawRecord,
        lastSyncedAt: data.lastSyncedAt,
      },
      create: data,
    })
    upserted++
  }

  return { rowsFetched: rows.length, rowsUpserted: upserted }
}
