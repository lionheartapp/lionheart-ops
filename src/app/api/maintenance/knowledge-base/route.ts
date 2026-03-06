/**
 * GET  /api/maintenance/knowledge-base — list articles with optional filters
 * POST /api/maintenance/knowledge-base — create a new article
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getArticles, createArticle } from '@/lib/services/knowledgeBaseService'
import type { KnowledgeArticleType } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.KB_READ)

    const url = new URL(req.url)
    const type = url.searchParams.get('type') as KnowledgeArticleType | null
    const keyword = url.searchParams.get('keyword') || undefined
    const assetId = url.searchParams.get('assetId') || undefined
    const tagsParam = url.searchParams.get('tags')
    const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined

    return await runWithOrgContext(orgId, async () => {
      const articles = await getArticles({ type: type ?? undefined, keyword, assetId, tags })
      return NextResponse.json(ok(articles))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/knowledge-base]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.KB_CREATE)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const article = await createArticle({
        ...body,
        createdById: ctx.userId,
      })
      return NextResponse.json(ok(article), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('ZodError')) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    // Handle Zod parse errors
    if (error && typeof error === 'object' && 'errors' in error) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input'), { status: 400 })
    }
    console.error('[POST /api/maintenance/knowledge-base]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
