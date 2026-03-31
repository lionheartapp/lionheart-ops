/**
 * GET    /api/maintenance/knowledge-base/[id] — fetch single article
 * PATCH  /api/maintenance/knowledge-base/[id] — update article
 * DELETE /api/maintenance/knowledge-base/[id] — soft-delete article
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getArticleById, updateArticle, deleteArticle } from '@/lib/services/knowledgeBaseService'

export const GET = withAuth(async ({ params }) => {
  const article = await getArticleById(params.id)
  if (!article) {
    return NextResponse.json(fail('NOT_FOUND', 'Article not found'), { status: 404 })
  }
  return NextResponse.json(ok(article))
}, { permission: PERMISSIONS.KB_READ })

export const PATCH = withAuth(async ({ req, params }) => {
  const body = await req.json()
  const article = await updateArticle(params.id, body)
  return NextResponse.json(ok(article))
}, { permission: PERMISSIONS.KB_UPDATE })

export const DELETE = withAuth(async ({ params }) => {
  await deleteArticle(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.KB_DELETE })
