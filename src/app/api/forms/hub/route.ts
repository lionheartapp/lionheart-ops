/**
 * GET /api/forms/hub — List all forms for the Forms Hub (system + custom, excludes ticket category forms)
 * POST /api/forms/hub — Create a new custom form
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { listForms, createForm, seedSystemForms } from '@/lib/services/formService'

export const GET = withAuth(async ({ orgId, ctx }) => {
  try {
    // Lazy seed: create system forms on first visit if they don't exist
    await seedSystemForms(orgId)
  } catch (e) {
    console.error('[forms/hub] seedSystemForms failed:', e)
    // Continue — show whatever forms exist even if seeding fails
  }
  const forms = await listForms(ctx.userId)
  return NextResponse.json(ok(forms))
})

const CreateFormSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
})

export const POST = withAuth(
  async ({ ctx, body }) => {
    const form = await createForm({
      name: body.name,
      description: body.description ?? null,
      createdBy: ctx.userId,
    })
    return NextResponse.json(ok(form), { status: 201 })
  },
  { permission: PERMISSIONS.FORMS_MANAGE, schema: CreateFormSchema }
)
