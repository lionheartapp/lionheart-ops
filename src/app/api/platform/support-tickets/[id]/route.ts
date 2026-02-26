import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { getTicketWithMessages, updateSupportTicket } from '@/lib/services/platformSupportService'
import { platformAudit, getPlatformIp } from '@/lib/services/platformAuditService'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.SUPPORT_TICKETS_READ)
    const { id } = await params

    const ticket = await getTicketWithMessages(id)
    if (!ticket) {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
    }

    return NextResponse.json(ok(ticket))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/platform/support-tickets/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.SUPPORT_TICKETS_MANAGE)
    const { id } = await params

    const body = await req.json()
    const { status, priority, assignedToAdminId, category } = body

    const ticket = await updateSupportTicket(id, {
      status: status || undefined,
      priority: priority || undefined,
      assignedToAdminId: assignedToAdminId !== undefined ? assignedToAdminId : undefined,
      category: category || undefined,
    })

    platformAudit({
      platformAdminId: ctx.adminId,
      action: 'support-ticket.update',
      resourceType: 'PlatformSupportTicket',
      resourceId: id,
      details: { status, priority, assignedToAdminId },
      ipAddress: getPlatformIp(req),
    })

    return NextResponse.json(ok(ticket))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[PATCH /api/platform/support-tickets/[id]]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
