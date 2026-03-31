/**
 * GET /api/maintenance/knowledge-base/search
 *
 * Full-text search endpoint used by the AI diagnostic panel and manual search.
 *
 * Query params:
 *   q        — free-text search query
 *   category — ticket category (uses findRelevantArticles when provided)
 *   limit    — max results (default 5)
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { searchArticles, findRelevantArticles } from '@/lib/services/knowledgeBaseService'

export const GET = withAuth(async ({ searchParams }) => {
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''
  const limit = searchParams.get('limit')
    ? parseInt(searchParams.get('limit')!, 10)
    : 5

  let articles: Awaited<ReturnType<typeof searchArticles>>

  if (category) {
    // AI panel mode: find articles relevant to ticket category + title
    articles = await findRelevantArticles(category, q) as typeof articles
  } else {
    // Manual search mode
    articles = await searchArticles(q, limit)
  }

  return NextResponse.json(ok(articles.slice(0, limit)))
}, { permission: PERMISSIONS.KB_READ })
