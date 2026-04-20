/**
 * GET /api/it/erate/documents — list E-Rate documents
 *   ?schoolYear=2025-2026
 *   ?taskId=...
 *   ?ben=17019271
 *   ?fundingYear=2026
 *   ?frnNumber=...
 *
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
  const ben = searchParams.get('ben') || undefined
  const fyParam = searchParams.get('fundingYear')
  const fundingYear = fyParam ? parseInt(fyParam, 10) : undefined
  const frnNumber = searchParams.get('frnNumber') || undefined

  const docs = await getERateDocuments(orgId, { schoolYear, taskId, ben, fundingYear, frnNumber })

  return NextResponse.json(ok(docs))
}, { permission: PERMISSIONS.IT_ERATE_VIEW })

export const POST = withAuth(async ({ req, orgId, ctx }) => {
  const body = await req.json()
  const {
    title, fileUrl, fileType, schoolYear, taskId, tags, retentionYears,
    ben, fundingYear, frnNumber, category, fileName, fileSize, mimeType, notes,
  } = body as {
    title: string
    fileUrl: string
    fileType?: string
    schoolYear?: string
    taskId?: string
    tags?: string[]
    retentionYears?: number
    ben?: string
    fundingYear?: number
    frnNumber?: string
    category?: string
    fileName?: string
    fileSize?: number
    mimeType?: string
    notes?: string
  }

  if (!title || !fileUrl) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'title and fileUrl are required'),
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
    ben,
    fundingYear,
    frnNumber,
    category,
    fileName,
    fileSize,
    mimeType,
    notes,
  })

  return NextResponse.json(ok(doc))
}, { permission: PERMISSIONS.IT_ERATE_MANAGE })
