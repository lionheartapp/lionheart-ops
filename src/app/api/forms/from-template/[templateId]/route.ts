/**
 * POST /api/forms/from-template/:templateId — Clone a template into a new form
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { cloneFromTemplate } from '@/lib/services/formTemplateService'

export const POST = withAuth<unknown, { templateId: string }>(
  async ({ ctx, params }) => {
    const form = await cloneFromTemplate(params.templateId, ctx.userId)
    if (!form) {
      return NextResponse.json(fail('NOT_FOUND', 'Template not found'), { status: 404 })
    }
    return NextResponse.json(ok(form), { status: 201 })
  },
  { permission: PERMISSIONS.FORMS_MANAGE }
)
