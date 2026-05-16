/**
 * GET  /api/forms/templates — List all available templates
 * POST /api/forms/templates — Save current form as template
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { listTemplates, saveFormAsTemplate, seedSystemTemplates } from '@/lib/services/formTemplateService'

export const GET = withAuth(async ({ orgId }) => {
  // Lazy seed system templates
  try {
    await seedSystemTemplates(orgId)
  } catch (e) {
    console.error('[forms/templates] seedSystemTemplates failed:', e)
  }

  const templates = await listTemplates()
  return NextResponse.json(ok(templates))
})

const SaveTemplateSchema = z.object({
  formId: z.string().min(1),
  name: z.string().min(1).max(200),
  category: z.string().max(100).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
})

export const POST = withAuth(
  async ({ body }) => {
    const template = await saveFormAsTemplate(
      body.formId,
      body.name,
      body.category,
      body.description
    )
    return NextResponse.json(ok(template), { status: 201 })
  },
  { permission: PERMISSIONS.FORMS_MANAGE, schema: SaveTemplateSchema }
)
