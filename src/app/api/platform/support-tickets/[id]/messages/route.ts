import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { addSupportMessage } from '@/lib/services/platformSupportService'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.SUPPORT_TICKETS_MANAGE)
    const { id } = await params

    const body = await req.json()
    if (!body.message?.trim()) {
      return NextResponse.json(fail('BAD_REQUEST', 'message is required'), { status: 400 })
    }

    const message = await addSupportMessage({
      ticketId: id,
      senderId: ctx.adminId,
      senderType: 'PLATFORM_ADMIN',
      message: body.message.trim(),
    })

    return NextResponse.json(ok(message), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/platform/support-tickets/[id]/messages]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
