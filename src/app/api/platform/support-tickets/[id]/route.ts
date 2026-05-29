import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { getTicketWithMessages, updateSupportTicket } from '@/lib/services/platformSupportService'
import { platformAudit, getPlatformIp } from '@/lib/services/platformAuditService'
import { sendViaResend, sendViaSmtp, getResendConfig, getSmtpConfig, getAppUrl } from '@/lib/services/email/transport'
// eslint-disable-next-line no-restricted-imports -- Platform support ticket admin operates outside tenant org scoping after platform permission checks.
import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'

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
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to get support ticket')
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

    // Notify the submitter when their ticket is resolved or closed
    if ((status === 'RESOLVED' || status === 'CLOSED') && ticket.submittedByUserId) {
      const submitter = await rawPrisma.user.findUnique({
        where: { id: ticket.submittedByUserId },
        select: { email: true, firstName: true },
      })
      if (submitter?.email) {
        const name = submitter.firstName || 'there'
        const statusLabel = status === 'RESOLVED' ? 'resolved' : 'closed'
        const appUrl = getAppUrl()
        const emailSubject = `Your support ticket has been ${statusLabel}`
        const emailText = [
          `Hi ${name},`,
          '',
          `Your support ticket "${ticket.subject}" has been ${statusLabel}.`,
          '',
          'If you have any further questions or the issue persists, you can submit a new ticket from the Help & Support menu.',
          '',
          'Thanks,',
          'The Lionheart Team',
        ].join('\n')
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b;">Hi ${name},</p>
            <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b;">Your support ticket <strong>&ldquo;${ticket.subject}&rdquo;</strong> has been <strong>${statusLabel}</strong>.</p>
            <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">If you have any further questions or the issue persists, you can submit a new ticket from the Help &amp; Support menu in the app.</p>
            <p style="margin: 0; font-size: 14px; color: #64748b;">Thanks,<br/>The Lionheart Team</p>
          </div>
        `
        const from = getResendConfig()?.from || getSmtpConfig()?.from || 'Lionheart <no-reply@lionheartapp.com>'
        sendViaResend(submitter.email, emailSubject, emailHtml, emailText, from)
          .then((r) => { if (!r.sent) return sendViaSmtp(submitter.email, emailSubject, emailHtml, emailText, from) })
          .catch((err) => logger.error({ err: String(err) }, 'Failed to send ticket resolution email'))
      }
    }

    return NextResponse.json(ok(ticket))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to update support ticket')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
