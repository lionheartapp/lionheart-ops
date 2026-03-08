import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getERateDocuments, uploadERateDocument } from '@/lib/services/itERateService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_ERATE_VIEW)

    const url = new URL(req.url)
    const schoolYear = url.searchParams.get('schoolYear') || undefined
    const taskId = url.searchParams.get('taskId') || undefined

    return await runWithOrgContext(orgId, async () => {
      const docs = await getERateDocuments(orgId, { schoolYear, taskId })
      return NextResponse.json(ok(docs))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch E-Rate documents:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_ERATE_MANAGE)

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

    return await runWithOrgContext(orgId, async () => {
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
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to upload E-Rate document:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
