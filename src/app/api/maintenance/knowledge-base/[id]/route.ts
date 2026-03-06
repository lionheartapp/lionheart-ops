/**
 * GET    /api/maintenance/knowledge-base/[id] — fetch single article
 * PATCH  /api/maintenance/knowledge-base/[id] — update article
 * DELETE /api/maintenance/knowledge-base/[id] — soft-delete article
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getArticleById, updateArticle, deleteArticle } from '@/lib/services/knowledgeBaseService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.KB_READ)

    return await runWithOrgContext(orgId, async () => {
      const article = await getArticleById(id)
      if (!article) {
        return NextResponse.json(fail('NOT_FOUND', 'Article not found'), { status: 404 })
      }
      return NextResponse.json(ok(article))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/knowledge-base/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.KB_UPDATE)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const article = await updateArticle(id, body)
      return NextResponse.json(ok(article))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[PATCH /api/maintenance/knowledge-base/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.KB_DELETE)

    return await runWithOrgContext(orgId, async () => {
      await deleteArticle(id)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[DELETE /api/maintenance/knowledge-base/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
