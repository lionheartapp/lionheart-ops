/**
 * USAC Open Data dataset registry.
 *
 * IDs are Socrata 4x4 identifiers verified against opendata.usac.org's catalog
 * (https://opendata.usac.org/api/views.json) on 2026-04-18.
 *
 * Each dataset is queryable as JSON at:
 *   https://opendata.usac.org/resource/{id}.json?$where=...&$limit=...
 *
 * Use the `last_change_date` (or per-dataset equivalent) for delta sync.
 *
 * Caveats:
 *   - Datasets typically retain ~10 funding years of history.
 *   - Field names vary across datasets — see per-module mappers for the exact
 *     SoQL columns each one uses.
 *   - Records may be re-emitted as USAC corrects data, so always upsert
 *     by the dataset's natural key (FRN, application number, etc.).
 */

export interface UsacDataset {
  /** Socrata 4x4 ID */
  id: string
  /** Stable internal key — referenced by sync modules */
  key: ErateDatasetKey
  /** Human label for logs and audit rows */
  label: string
  /** USAC E-Rate category this dataset rolls up to */
  scope: 'entity' | 'form470' | 'form471' | 'frn' | 'disbursement' | 'service-provider' | 'c2-budget'
}

export type ErateDatasetKey =
  | 'entitySupplemental'
  | 'entityAnnexes'
  | 'form471Basic'
  | 'form471FrnStatus'
  | 'form471FrnLineItems'
  | 'form471Recipients'
  | 'form471Connectivity'
  | 'form471DiscountCalc'
  | 'form471Consultants'
  | 'form470Basic'
  | 'form470Services'
  | 'form470Consortium'
  | 'form470Consultants'
  | 'frnStatusFy2016Plus'
  | 'frnInvoiceDeadline'
  | 'invoiceDisbursementsLookup'
  | 'invoicesAndDisbursements'
  | 'serviceProviderInfo'
  | 'recipientDetailsAndCommitments'
  | 'c2BudgetTool'
  | 'c2BudgetToolData'

export const USAC_OPEN_DATA_BASE = 'https://opendata.usac.org/resource'

/**
 * Verified E-Rate datasets. Order roughly matches the funding-year lifecycle:
 *   entity → 470 → 471 → FRN → invoices.
 */
export const ERATE_DATASETS: Record<ErateDatasetKey, UsacDataset> = {
  // ─── Entity / applicant identity ────────────────────────────────────────────
  entitySupplemental: {
    id: '7i5i-83qf',
    key: 'entitySupplemental',
    label: 'E-Rate Supplemental Entity Information',
    scope: 'entity',
  },
  entityAnnexes: {
    id: 'hwzi-t5nj',
    key: 'entityAnnexes',
    label: 'E-Rate Supplemental Information: Annexes',
    scope: 'entity',
  },

  // ─── Form 471 (request for discount) ────────────────────────────────────────
  form471Basic: {
    id: '9s6i-myen',
    key: 'form471Basic',
    label: 'E-Rate Form 471 Basic Information',
    scope: 'form471',
  },
  form471FrnStatus: {
    id: 'qdmp-ygft',
    key: 'form471FrnStatus',
    label: 'E-Rate Form 471 FRN Status',
    scope: 'frn',
  },
  form471FrnLineItems: {
    id: 'hbj5-2bpj',
    key: 'form471FrnLineItems',
    label: 'E-Rate Form 471 FRN Line Items',
    scope: 'frn',
  },
  form471Recipients: {
    id: 'tuem-agyq',
    key: 'form471Recipients',
    label: 'E-Rate Form 471 Recipients of Service',
    scope: 'form471',
  },
  form471Connectivity: {
    id: 'ym44-rnhq',
    key: 'form471Connectivity',
    label: 'E-Rate Form 471 Connectivity Information',
    scope: 'form471',
  },
  form471DiscountCalc: {
    id: 'upfy-khtr',
    key: 'form471DiscountCalc',
    label: 'E-Rate Form 471 Discount Calculations',
    scope: 'form471',
  },
  form471Consultants: {
    id: 'x5px-esft',
    key: 'form471Consultants',
    label: 'E-Rate Form 471 Consultants',
    scope: 'form471',
  },

  // ─── Form 470 (open competitive bidding) ────────────────────────────────────
  form470Basic: {
    id: 'jp7a-89nd',
    key: 'form470Basic',
    label: 'E-Rate Form 470 Basic Information',
    scope: 'form470',
  },
  form470Services: {
    id: '39tn-hjzv',
    key: 'form470Services',
    label: 'E-Rate Form 470 Services Requested',
    scope: 'form470',
  },
  form470Consortium: {
    id: '363f-22uh',
    key: 'form470Consortium',
    label: 'E-Rate Form 470 Consortium Entity Information',
    scope: 'form470',
  },
  form470Consultants: {
    id: 'g55z-erud',
    key: 'form470Consultants',
    label: 'E-Rate Form 470 Consultants',
    scope: 'form470',
  },

  // ─── FRN status & invoice deadlines ─────────────────────────────────────────
  frnStatusFy2016Plus: {
    id: '8xzh-ytkh',
    key: 'frnStatusFy2016Plus',
    label: 'E-Rate FRN Status Tool FY2016+',
    scope: 'frn',
  },
  frnInvoiceDeadline: {
    id: 'sfyf-vvtz',
    key: 'frnInvoiceDeadline',
    label: 'E-Rate FRN Invoice Deadline Tool',
    scope: 'frn',
  },

  // ─── Disbursements (forms 472 / 474) ────────────────────────────────────────
  invoiceDisbursementsLookup: {
    id: 't3vg-gfse',
    key: 'invoiceDisbursementsLookup',
    label: 'E-Rate Invoice Disbursements Data Lookup Tool',
    scope: 'disbursement',
  },
  invoicesAndDisbursements: {
    id: 'jpiu-tj8h',
    key: 'invoicesAndDisbursements',
    label: 'E-Rate Invoices and Authorized Disbursements (Forms 472/474)',
    scope: 'disbursement',
  },

  // ─── Reference data ─────────────────────────────────────────────────────────
  serviceProviderInfo: {
    id: 'xcy2-bdid',
    key: 'serviceProviderInfo',
    label: 'E-Rate Service Provider Information',
    scope: 'service-provider',
  },
  recipientDetailsAndCommitments: {
    id: 'avi8-svp9',
    key: 'recipientDetailsAndCommitments',
    label: 'E-Rate Recipient Details and Commitments',
    scope: 'frn',
  },

  // ─── Category 2 budgets ─────────────────────────────────────────────────────
  c2BudgetTool: {
    id: '8z69-hkn7',
    key: 'c2BudgetTool',
    label: 'E-Rate C2 Budget Tool FY2021+',
    scope: 'c2-budget',
  },
  c2BudgetToolData: {
    id: '6brt-5pbv',
    key: 'c2BudgetToolData',
    label: 'E-Rate C2 Budget Tool Data FY2021+',
    scope: 'c2-budget',
  },
}

/**
 * The minimum dataset set we sync on first onboarding for a given BEN.
 * Other datasets are pulled lazily / on demand to keep first-sync latency low.
 */
export const ONBOARDING_DATASETS: ErateDatasetKey[] = [
  'entitySupplemental',
  'form471Basic',
  'form471FrnStatus',
  'form470Basic',
  'frnStatusFy2016Plus',
  'invoicesAndDisbursements',
]

/**
 * Convenience lookup for sync routes.
 */
export function getDatasetByKey(key: ErateDatasetKey): UsacDataset {
  return ERATE_DATASETS[key]
}
