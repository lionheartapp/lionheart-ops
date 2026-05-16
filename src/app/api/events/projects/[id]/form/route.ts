/**
 * GET  /api/events/projects/:id/form — Fetch the per-event form (clones on first request)
 * POST /api/events/projects/:id/form/reset — Reset the per-event form to the template
 *
 * Every event gets its own copy of the system form template. The first GET
 * auto-clones from the template. Subsequent GETs return the existing copy.
 * Edits to one event's form don't affect other events or the template.
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { cloneFormForEvent, seedSystemForms, getFormById } from '@/lib/services/formService'

const FULL_FORM_INCLUDE = {
  pages: {
    orderBy: { sortOrder: 'asc' as const },
    include: { fields: { orderBy: { sortOrder: 'asc' as const } } },
  },
  fields: {
    where: { pageId: null },
    orderBy: { sortOrder: 'asc' as const },
  },
  actions: { orderBy: { sortOrder: 'asc' as const } },
}

export const GET = withAuth<unknown, { id: string }>(
  async ({ orgId, params }) => {
    const eventId = params.id

    // Check if this event already has a form copy
    const existing = await prisma.formDefinition.findFirst({
      where: { eventId },
      include: FULL_FORM_INCLUDE,
    })

    if (existing) {
      return NextResponse.json(ok(existing))
    }

    // No form yet — find the system template and clone it
    await seedSystemForms(orgId)

    // Determine which template to use based on the event's isMultiDay flag
    const event = await prisma.eventProject.findFirst({
      where: { id: eventId },
      select: { isMultiDay: true },
    })

    if (!event) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Event not found'),
        { status: 404 }
      )
    }

    const systemKey = event.isMultiDay ? 'multiday_event' : 'single_event'
    const template = await prisma.formDefinition.findFirst({
      where: { systemKey, isDefault: true },
      select: { id: true },
    })

    if (!template) {
      return NextResponse.json(
        fail('NOT_FOUND', 'System form template not found'),
        { status: 404 }
      )
    }

    // Clone the template for this event
    const cloned = await cloneFormForEvent(template.id, eventId, orgId)

    return NextResponse.json(ok(cloned), { status: 201 })
  }
)
