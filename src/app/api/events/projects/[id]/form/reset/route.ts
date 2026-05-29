/**
 * POST /api/events/projects/:id/form/reset — Reset per-event form to template
 *
 * Deletes the current per-event form and re-clones from the parent template.
 * This undoes all customizations made to this specific event's form.
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
// eslint-disable-next-line no-restricted-imports -- Form reset must hard-delete/reclone nested form records after scoped ownership is verified.
import { rawPrisma } from '@/lib/db'
import { cloneFormForEvent } from '@/lib/services/formService'

export const POST = withAuth<unknown, { id: string }>(
  async ({ orgId, params }) => {
    const eventId = params.id

    // Find the existing per-event form
    const existing = await prisma.formDefinition.findFirst({
      where: { eventId },
      select: { id: true, parentTemplateId: true },
    })

    if (!existing) {
      return NextResponse.json(
        fail('NOT_FOUND', 'No form found for this event'),
        { status: 404 }
      )
    }

    if (!existing.parentTemplateId) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'This form has no parent template to reset to'),
        { status: 400 }
      )
    }

    // Delete the current form (cascades to pages, fields, actions)
    await rawPrisma.formDefinition.delete({ where: { id: existing.id } })

    // Re-clone from the parent template
    const cloned = await cloneFormForEvent(existing.parentTemplateId, eventId, orgId)

    return NextResponse.json(ok(cloned))
  },
  { permission: PERMISSIONS.FORMS_MANAGE }
)
