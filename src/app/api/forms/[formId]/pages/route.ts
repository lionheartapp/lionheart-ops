/**
 * POST /api/forms/[formId]/pages — Add a page to a form
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { addPage } from '@/lib/services/formService'
import { formPageSchema } from '@/lib/forms/schemas'

export const POST = withAuth(
  async ({ params, body }) => {
    const page = await addPage(params.formId, body)
    return NextResponse.json(ok(page), { status: 201 })
  },
  { permission: PERMISSIONS.FORMS_MANAGE, schema: formPageSchema }
)
