/**
 * PUT /api/forms/[formId]/pages/reorder — Reorder pages
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { reorderPages } from '@/lib/services/formService'

const ReorderSchema = z.object({
  pageIds: z.array(z.string().min(1)).min(1),
})

export const PUT = withAuth(
  async ({ params, body }) => {
    const form = await reorderPages(params.formId, body.pageIds)
    return NextResponse.json(ok(form))
  },
  { permission: PERMISSIONS.FORMS_MANAGE, schema: ReorderSchema }
)
