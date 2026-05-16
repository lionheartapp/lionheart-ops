/**
 * GET    /api/forms/[formId]/detail — Get full form with pages, fields, actions
 * PATCH  /api/forms/[formId]/detail — Update form settings
 * DELETE /api/forms/[formId]/detail — Delete a custom form (system forms: 403)
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getFormById, updateForm, deleteForm } from '@/lib/services/formService'

export const GET = withAuth(async ({ params }) => {
  const form = await getFormById(params.formId)
  if (!form) {
    return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
  }
  return NextResponse.json(ok(form))
})

const UpdateFormSchema = z.object({
  description: z.string().max(2000).nullable().optional(),
  coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  confirmMessage: z.string().max(2000).nullable().optional(),
  redirectUrl: z.string().url().nullable().optional(),
  autoSave: z.boolean().optional(),
  allowDrafts: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  requireEmail: z.boolean().optional(),
})

export const PATCH = withAuth(
  async ({ params, body }) => {
    const form = await updateForm(params.formId, body)
    return NextResponse.json(ok(form))
  },
  { permission: PERMISSIONS.FORMS_MANAGE, schema: UpdateFormSchema }
)

export const DELETE = withAuth(
  async ({ params }) => {
    try {
      await deleteForm(params.formId)
      return NextResponse.json(ok({ deleted: true }))
    } catch (error) {
      if (error instanceof Error && error.message.includes('System forms')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      throw error
    }
  },
  { permission: PERMISSIONS.FORMS_MANAGE }
)
