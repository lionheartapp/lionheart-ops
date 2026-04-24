/**
 * GET /api/forms/category/[categoryKey] — Get or seed default form for a ticket category
 * PUT /api/forms/category/[categoryKey] — Update all fields for a category form
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { runWithOrgContext } from '@/lib/org-context'
import {
  getOrSeedCategoryForm,
  updateCategoryFormFields,
} from '@/lib/services/formService'
import { formFieldSchema } from '@/lib/forms/schemas'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { z } from 'zod'

type RouteParams = { params: Promise<{ categoryKey: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { categoryKey } = await params

    return await runWithOrgContext(orgId, async () => {
      const form = await cacheOrgWide(
        orgId,
        `forms:category:${categoryKey}`,
        () => getOrSeedCategoryForm(categoryKey),
        { ttlMs: 120000 }
      )
      return NextResponse.json(ok(form))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

const updateBodySchema = z.object({
  fields: z.array(formFieldSchema),
})

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { categoryKey } = await params
    const body = await req.json()
    const parsed = updateBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid field data', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      // Ensure the form exists (seed if needed)
      const form = await getOrSeedCategoryForm(categoryKey)
      const updated = await updateCategoryFormFields(form.id, parsed.data.fields)
      invalidateOrgCache(orgId, 'forms:category')
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
