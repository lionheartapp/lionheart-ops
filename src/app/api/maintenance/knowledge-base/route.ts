/**
 * GET  /api/maintenance/knowledge-base — list articles with optional filters
 * POST /api/maintenance/knowledge-base — create a new article
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getArticles, createArticle } from '@/lib/services/knowledgeBaseService'
import type { KnowledgeArticleType } from '@prisma/client'

export const GET = withAuth(async ({ searchParams }) => {
  const type = searchParams.get('type') as KnowledgeArticleType | null
  const keyword = searchParams.get('keyword') || undefined
  const assetId = searchParams.get('assetId') || undefined
  const tagsParam = searchParams.get('tags')
  const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined

  const articles = await getArticles({ type: type ?? undefined, keyword, assetId, tags })
  return NextResponse.json(ok(articles))
}, { permission: PERMISSIONS.KB_READ })

export const POST = withAuth(async ({ req, ctx }) => {
  const body = await req.json()
  const article = await createArticle({
    ...body,
    createdById: ctx.userId,
  })
  return NextResponse.json(ok(article), { status: 201 })
}, { permission: PERMISSIONS.KB_CREATE })
