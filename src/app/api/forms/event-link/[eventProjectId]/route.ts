/**
 * GET    /api/forms/event-link/[eventProjectId] — Get the form linked to an event
 * POST   /api/forms/event-link/[eventProjectId] — Create or link a form to an event
 * DELETE /api/forms/event-link/[eventProjectId] — Unlink a form from an event
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { z } from 'zod'

type RouteParams = { params: Promise<{ eventProjectId: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { eventProjectId } = await params

    return await runWithOrgContext(orgId, async () => {
      const form = await prisma.formDefinition.findFirst({
        where: { eventProjectId },
        select: {
          id: true,
          description: true,
          _count: {
            select: {
              ticketTypes: true,
              submissions: true,
              orders: true,
            },
          },
        },
      })

      if (!form) {
        return NextResponse.json(ok(null))
      }

      return NextResponse.json(ok({
        id: form.id,
        description: form.description,
        ticketTypeCount: form._count.ticketTypes,
        submissionCount: form._count.submissions,
        orderCount: form._count.orders,
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

const postSchema = z.object({
  action: z.enum(['create', 'link']),
  formId: z.string().optional(), // required when action = 'link'
})

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { eventProjectId } = await params
    const body = await req.json()
    const parsed = postSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request'), { status: 400 })
    }

    return await runWithOrgContext(orgId, async () => {
      // Check if event already has a linked form
      const existing = await prisma.formDefinition.findFirst({
        where: { eventProjectId },
        select: { id: true },
      })
      if (existing) {
        return NextResponse.json(fail('CONFLICT', 'Event already has a linked form'), { status: 409 })
      }

      // Verify event exists
      const event = await prisma.eventProject.findFirst({
        where: { id: eventProjectId },
        select: { id: true, title: true },
      })
      if (!event) {
        return NextResponse.json(fail('NOT_FOUND', 'Event not found'), { status: 404 })
      }

      if (parsed.data.action === 'create') {
        // Create a new form linked to this event
        const form = await prisma.formDefinition.create({
          data: {
            organizationId: orgId,
            eventProjectId,
            context: 'CUSTOM',
            visibility: 'SHARED',
            description: event.title,
            isPublic: true,
            requireEmail: true,
            createdBy: ctx.userId,
          },
        })
        return NextResponse.json(ok({ formId: form.id }), { status: 201 })
      }

      if (parsed.data.action === 'link') {
        if (!parsed.data.formId) {
          return NextResponse.json(fail('VALIDATION_ERROR', 'formId required for link action'), { status: 400 })
        }
        // Link existing form
        const form = await prisma.formDefinition.findFirst({
          where: { id: parsed.data.formId, eventProjectId: null },
          select: { id: true },
        })
        if (!form) {
          return NextResponse.json(fail('NOT_FOUND', 'Form not found or already linked'), { status: 404 })
        }

        await prisma.formDefinition.update({
          where: { id: form.id },
          data: { eventProjectId },
        })

        return NextResponse.json(ok({ formId: form.id }))
      }

      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid action'), { status: 400 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { eventProjectId } = await params

    return await runWithOrgContext(orgId, async () => {
      const form = await prisma.formDefinition.findFirst({
        where: { eventProjectId },
        select: { id: true },
      })

      if (!form) {
        return NextResponse.json(ok({ unlinked: true })) // idempotent
      }

      await prisma.formDefinition.update({
        where: { id: form.id },
        data: { eventProjectId: null },
      })

      return NextResponse.json(ok({ unlinked: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
