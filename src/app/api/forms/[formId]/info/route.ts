/**
 * GET /api/forms/[formId]/info — Get form attachment summary (for delete confirmation)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

type RouteParams = { params: Promise<{ formId: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { formId } = await params

    return await runWithOrgContext(orgId, async () => {
      const form = await prisma.formDefinition.findFirst({
        where: { id: formId },
        select: {
          id: true,
          description: true,
          eventProjectId: true,
          isDefault: true,
          systemKey: true,
          _count: {
            select: {
              submissions: true,
              orders: true,
              ticketTypes: true,
              pages: true,
              fields: true,
            },
          },
        },
      })

      if (!form) {
        return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
      }

      // Count tickets across all orders
      const ticketCount = await prisma.eventTicket.count({
        where: { order: { formId } },
      })

      // Get linked event name if any
      let linkedEventName: string | null = null
      if (form.eventProjectId) {
        const event = await prisma.eventProject.findFirst({
          where: { id: form.eventProjectId },
          select: { title: true },
        })
        linkedEventName = event?.title ?? null
      }

      return NextResponse.json(ok({
        id: form.id,
        name: form.description || 'Untitled Form',
        isSystem: !!(form.isDefault || form.systemKey),
        submissions: form._count.submissions,
        orders: form._count.orders,
        tickets: ticketCount,
        ticketTypes: form._count.ticketTypes,
        pages: form._count.pages,
        fields: form._count.fields,
        linkedEvent: linkedEventName,
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
