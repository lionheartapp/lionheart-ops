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

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { searchArticles, findRelevantArticles } from '@/lib/services/knowledgeBaseService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.KB_READ)

    const url = new URL(req.url)
    const q = url.searchParams.get('q') || ''
    const category = url.searchParams.get('category') || ''
    const limit = url.searchParams.get('limit')
      ? parseInt(url.searchParams.get('limit')!, 10)
      : 5

    return await runWithOrgContext(orgId, async () => {
      let articles: Awaited<ReturnType<typeof searchArticles>>

      if (category) {
        // AI panel mode: find articles relevant to ticket category + title
        articles = await findRelevantArticles(category, q) as typeof articles
      } else {
        // Manual search mode
        articles = await searchArticles(q, limit)
      }

      return NextResponse.json(ok(articles.slice(0, limit)))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/knowledge-base/search]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
