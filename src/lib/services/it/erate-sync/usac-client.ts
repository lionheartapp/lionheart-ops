/**
 * USAC Open Data (Socrata) HTTP client.
 *
 * Wraps the SoQL API at https://opendata.usac.org/resource/{datasetId}.json
 * with pagination, typed where-clause helpers, and a cap to protect against
 * runaway syncs.
 *
 * No auth is required for read access. If we ever need higher rate limits,
 * we can register a Socrata app token and pass it via X-App-Token.
 */

import { logger } from '@/lib/logger'
import { USAC_OPEN_DATA_BASE, type UsacDataset } from './datasets'

const log = logger.child({ service: 'usac-client' })

/** Hard upper bound on rows returned in a single sync invocation. */
const MAX_ROWS_PER_SYNC = 50_000
/** Socrata's per-page limit. 50k is its documented hard cap. */
const PAGE_SIZE = 5_000

export interface UsacQuery {
  /** SoQL `$where` clause, e.g. `ben='123'` */
  where?: string
  /** SoQL `$select` clause, e.g. `frn,frn_status` */
  select?: string
  /** SoQL `$order` clause, e.g. `last_change_date DESC` */
  order?: string
  /** Cap on rows returned across all pages (defaults to MAX_ROWS_PER_SYNC) */
  maxRows?: number
  /** Optional Socrata app token. Falls back to USAC_OPEN_DATA_APP_TOKEN env var. */
  appToken?: string
}

export interface UsacFetchResult<T> {
  rows: T[]
  pagesFetched: number
  totalRows: number
  truncated: boolean
}

/**
 * Wrap a runtime error with stable identifying information so the sync
 * orchestrator can log it consistently.
 */
class UsacFetchError extends Error {
  readonly status: number | null
  readonly datasetId: string

  constructor(
    datasetId: string,
    status: number | null,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = 'UsacFetchError'
    this.datasetId = datasetId
    this.status = status
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unknown error'
}

function buildUrl(
  dataset: UsacDataset,
  query: UsacQuery,
  limit: number,
  offset: number
): string {
  const url = new URL(`${USAC_OPEN_DATA_BASE}/${dataset.id}.json`)
  url.searchParams.set('$limit', String(limit))
  url.searchParams.set('$offset', String(offset))
  if (query.where) url.searchParams.set('$where', query.where)
  if (query.select) url.searchParams.set('$select', query.select)
  if (query.order) url.searchParams.set('$order', query.order)
  return url.toString()
}

async function fetchPage<T>(
  dataset: UsacDataset,
  query: UsacQuery,
  limit: number,
  offset: number,
  appToken?: string
): Promise<T[]> {
  const url = buildUrl(dataset, query, limit, offset)
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = appToken ?? process.env.USAC_OPEN_DATA_APP_TOKEN
  if (token) {
    headers['X-App-Token'] = token
  }

  let res: Response
  try {
    res = await fetch(url, { headers })
  } catch (error: unknown) {
    throw new UsacFetchError(
      dataset.id,
      null,
      `Network error fetching ${dataset.label}: ${getErrorMessage(error)}`,
      { cause: error }
    )
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new UsacFetchError(
      dataset.id,
      res.status,
      `USAC ${dataset.label} returned HTTP ${res.status}: ${body.slice(0, 500)}`
    )
  }

  let parsed: unknown
  try {
    parsed = await res.json()
  } catch (error: unknown) {
    throw new UsacFetchError(
      dataset.id,
      res.status,
      `USAC ${dataset.label} returned invalid JSON: ${getErrorMessage(error)}`,
      { cause: error }
    )
  }

  if (!Array.isArray(parsed)) {
    throw new UsacFetchError(
      dataset.id,
      res.status,
      `USAC ${dataset.label} returned a non-array payload`
    )
  }

  return parsed as T[]
}

/**
 * Fetch all rows matching the given query, transparently paginating
 * up to maxRows. Stops as soon as a short page is returned.
 */
export async function fetchUsacDataset<T = Record<string, unknown>>(
  dataset: UsacDataset,
  query: UsacQuery = {}
): Promise<UsacFetchResult<T>> {
  const cap = Math.min(query.maxRows ?? MAX_ROWS_PER_SYNC, MAX_ROWS_PER_SYNC)
  const all: T[] = []
  let offset = 0
  let pages = 0
  let truncated = false

  while (all.length < cap) {
    const remaining = cap - all.length
    const pageSize = Math.min(PAGE_SIZE, remaining)
    const page = await fetchPage<T>(dataset, query, pageSize, offset, query.appToken)
    pages++
    all.push(...page)
    if (page.length < pageSize) {
      // No more rows on the server.
      break
    }
    if (all.length >= cap) {
      truncated = true
      break
    }
    offset += page.length
  }

  log.info(
    {
      datasetId: dataset.id,
      pages,
      rows: all.length,
      truncated,
    },
    `USAC fetch ok — ${dataset.label}`
  )

  return { rows: all, pagesFetched: pages, totalRows: all.length, truncated }
}

/**
 * Build a SoQL where clause that matches a single BEN. We accept either the
 * column name `ben` (most datasets) or `billed_entity_number` (some legacy
 * datasets) and let the caller pick.
 */
export function whereBen(ben: string, column: string = 'ben'): string {
  const safe = String(ben).replace(/'/g, "''")
  return `${column}='${safe}'`
}

/** Combine multiple where fragments with AND. Empty/undefined fragments are skipped. */
export function andWhere(...fragments: Array<string | undefined | null>): string | undefined {
  const parts = fragments.filter((f): f is string => Boolean(f && f.trim().length))
  if (parts.length === 0) return undefined
  if (parts.length === 1) return parts[0]
  return parts.map((p) => `(${p})`).join(' AND ')
}

export { UsacFetchError }
