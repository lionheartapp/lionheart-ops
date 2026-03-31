/**
 * GET /api/it/erate/documents — list E-Rate documents
 * POST /api/it/erate/documents — upload an E-Rate document
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getERateDocuments, uploadERateDocument } from '@/lib/services/itERateService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const schoolYear = searchParams.get('schoolYear') || undefined
  const taskId = searchParams.get('taskId') || undefined

  const docs = await getERateDocuments(orgId, { schoolYear, taskId })

  return NextResponse.json(ok(docs))
}, { permission: PERMISSIONS.IT_ERATE_VIEW })

export const POST = withAuth(async ({ req, orgId, ctx }) => {
  const body = await req.json()
  const { title, fileUrl, fileType, schoolYear, taskId, tags, retentionYears } = body as {
    title: string
    fileUrl: string
    fileType?: string
    schoolYear: string
    taskId?: string
    tags?: string[]
    retentionYears?: number
  }

  if (!title || !fileUrl || !schoolYear) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'title, fileUrl, and schoolYear are required'),
      { status: 400 }
    )
  }

  const doc = await uploadERateDocument(orgId, {
    title,
    fileUrl,
    fileType,
    schoolYear,
    taskId,
    uploadedById: ctx.userId,
    tags,
    retentionYears,
  })

  return NextResponse.json(ok(doc))
}, { permission: PERMISSIONS.IT_ERATE_MANAGE })
