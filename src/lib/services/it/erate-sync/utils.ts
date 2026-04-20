/**
 * Shared parsing helpers for USAC Open Data records.
 *
 * Socrata returns everything as strings, so we have to coerce defensively.
 * Field names sometimes vary between datasets (e.g. `ben` vs.
 * `billed_entity_number`), so each helper accepts a list of candidate keys.
 */

export type Raw = Record<string, unknown>

export function pickString(record: Raw, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = record[k]
    if (v === null || v === undefined) continue
    const s = String(v).trim()
    if (s.length > 0) return s
  }
  return null
}

export function pickInt(record: Raw, ...keys: string[]): number | null {
  const s = pickString(record, ...keys)
  if (s === null) return null
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Coerce a Socrata money/decimal string to a JS number suitable for
 * Prisma Decimal. Returns null when the value is missing or invalid.
 */
export function pickDecimal(record: Raw, ...keys: string[]): number | null {
  const s = pickString(record, ...keys)
  if (s === null) return null
  const cleaned = s.replace(/[$,]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function pickDate(record: Raw, ...keys: string[]): Date | null {
  const s = pickString(record, ...keys)
  if (s === null) return null
  const d = new Date(s)
  return Number.isFinite(d.getTime()) ? d : null
}

/**
 * USAC's "funding year" is sometimes reported as `funding_year` (int),
 * sometimes as `funding_year_num`, sometimes as `fy`. Normalize.
 */
export function pickFundingYear(record: Raw): number | null {
  return pickInt(record, 'funding_year', 'funding_year_num', 'fy')
}

/**
 * BENs are sometimes integers in the JSON payload, sometimes strings.
 * Always store as a trimmed string in our DB to keep keys stable.
 */
export function pickBen(record: Raw): string | null {
  return pickString(record, 'ben', 'billed_entity_number', 'entity_number', 'epc_organization_id', 'recipient_ben')
}

/** Compute Allowable Contract Date = certified date + 28 days (E-Rate rule). */
export function addDays(date: Date | null, days: number): Date | null {
  if (!date) return null
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + days)
  return d
}
