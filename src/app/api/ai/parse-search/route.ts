import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { geminiService } from '@/lib/services/ai/gemini.service'
import type { SearchContext, ParsedSearchFilter } from '@/lib/services/ai/gemini.service'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const contextItemSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const ParseSearchSchema = z.object({
  query: z.string().trim().min(3).max(500),
  context: z.object({
    schools: z.array(contextItemSchema),
    campuses: z.array(contextItemSchema),
    categories: z.array(contextItemSchema),
    sports: z.array(contextItemSchema),
  }),
})

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/ai/parse-search', method: 'POST' })
  try {
    await getUserContext(req)
    const body = await req.json()
    const { query, context } = ParseSearchSchema.parse(body)

    const parsed = await geminiService.parseSearchQuery(query, context as SearchContext)

    // Resolve names to IDs for the client
    const resolved = resolveNamesToIds(parsed, context as SearchContext)

    return NextResponse.json(ok(resolved))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    log.error({ err: error }, 'Failed to parse search query')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to parse search'), { status: 500 })
  }
}

/**
 * Fuzzy-match AI-returned names against actual context items and resolve to IDs.
 */
function resolveNamesToIds(
  parsed: ParsedSearchFilter,
  context: SearchContext,
) {
  const fuzzyMatch = (name: string, items: Array<{ id: string; name: string }>) => {
    const lower = name.toLowerCase()
    // Exact match first
    const exact = items.find((i) => i.name.toLowerCase() === lower)
    if (exact) return exact.id
    // Substring match
    const partial = items.find(
      (i) => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase()),
    )
    return partial?.id ?? null
  }

  const schoolIds = (parsed.schoolNames as string[] | undefined)
    ?.map((n) => fuzzyMatch(n, context.schools))
    .filter(Boolean) as string[] | undefined

  const campusIds = (parsed.campusNames as string[] | undefined)
    ?.map((n) => fuzzyMatch(n, context.campuses))
    .filter(Boolean) as string[] | undefined

  const categoryIds = (parsed.categoryNames as string[] | undefined)
    ?.map((n) => fuzzyMatch(n, context.categories))
    .filter(Boolean) as string[] | undefined

  const sportIds = (parsed.sportNames as string[] | undefined)
    ?.map((n) => fuzzyMatch(n, context.sports))
    .filter(Boolean) as string[] | undefined

  return {
    titleSearch: parsed.titleSearch as string | undefined,
    schoolIds: schoolIds?.length ? schoolIds : undefined,
    campusIds: campusIds?.length ? campusIds : undefined,
    categoryIds: categoryIds?.length ? categoryIds : undefined,
    schoolLevels: parsed.schoolLevels as string[] | undefined,
    sportIds: sportIds?.length ? sportIds : undefined,
    teamLevels: parsed.teamLevels as string[] | undefined,
    dateRange: parsed.dateRange as { start: string; end: string } | undefined,
    summary: parsed.summary as string | undefined,
  }
}
