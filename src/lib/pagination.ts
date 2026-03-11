/**
 * Shared pagination utility
 *
 * Provides consistent offset-based pagination parsing and metadata building
 * across all list endpoints. Uses ?page=N&limit=N query params.
 *
 * Reference implementation: src/app/api/settings/audit-logs/route.ts
 */

export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Parse pagination parameters from URLSearchParams.
 *
 * Defaults: page=1, limit=25
 * Clamping: page minimum 1; limit between 1 and maxLimit (default 100)
 * Non-numeric values fall back to their defaults gracefully.
 *
 * @param searchParams - URLSearchParams from the request URL
 * @param defaultLimit - Default limit when not provided (default 25)
 * @param maxLimit - Maximum allowed limit (default 100)
 */
export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit = 25,
  maxLimit = 100
): PaginationParams {
  const page = Math.max(
    1,
    parseInt(searchParams.get('page') ?? '1', 10) || 1
  )
  const limit = Math.min(
    maxLimit,
    Math.max(
      1,
      parseInt(searchParams.get('limit') ?? String(defaultLimit), 10) || defaultLimit
    )
  )
  return { page, limit, skip: (page - 1) * limit }
}

/**
 * Build pagination metadata for the response envelope.
 *
 * @param total - Total number of matching records (from COUNT query)
 * @param params - Parsed pagination params from parsePagination()
 */
export function paginationMeta(total: number, params: PaginationParams): PaginationMeta {
  return {
    total,
    page: params.page,
    limit: params.limit,
    totalPages: total > 0 ? Math.ceil(total / params.limit) : 0,
  }
}
