/**
 * PATCH /api/forms/[formId]/fields/[fieldId] — Update a single field
 * DELETE /api/forms/[formId]/fields/[fieldId] — Remove a field
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { runWithOrgContext } from '@/lib/org-context'
import { updateField, removeField, touchFormUpdatedBy } from '@/lib/services/formService'
import { formFieldSchema } from '@/lib/forms/schemas'
import { invalidateOrgCache } from '@/lib/cache/route-cache'

type RouteParams = { params: Promise<{ formId: string; fieldId: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { formId, fieldId } = await params
    const body = await req.json()
    const parsed = formFieldSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid field data', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const field = await updateField(fieldId, parsed.data)
      touchFormUpdatedBy(formId, ctx.userId).catch(() => {})
      invalidateOrgCache(orgId, 'forms:category')
      return NextResponse.json(ok(field))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { fieldId } = await params

    return await runWithOrgContext(orgId, async () => {
      await removeField(fieldId)
      invalidateOrgCache(orgId, 'forms:category')
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
