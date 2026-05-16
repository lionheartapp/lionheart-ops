/**
 * PATCH  /api/forms/[formId]/pages/[pageId] — Update a page
 * DELETE /api/forms/[formId]/pages/[pageId] — Remove a page (fields move to unassigned)
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { updatePage, removePage } from '@/lib/services/formService'

const UpdatePageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isOptional: z.boolean().optional(),
  condFieldKey: z.string().nullable().optional(),
  condOperator: z.string().nullable().optional(),
  condEquals: z.string().nullable().optional(),
})

export const PATCH = withAuth(
  async ({ params, body }) => {
    const page = await updatePage(params.pageId, body)
    return NextResponse.json(ok(page))
  },
  { permission: PERMISSIONS.FORMS_MANAGE, schema: UpdatePageSchema }
)

export const DELETE = withAuth(
  async ({ params }) => {
    await removePage(params.pageId)
    return NextResponse.json(ok({ deleted: true }))
  },
  { permission: PERMISSIONS.FORMS_MANAGE }
)
