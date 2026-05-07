import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { addSupportMessage, getTicketWithMessages } from '@/lib/services/platformSupportService'
import { sendViaResend, sendViaSmtp, getResendConfig, getSmtpConfig } from '@/lib/services/email/transport'
import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'

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

    // Email the reply to the user who submitted the ticket
    const ticket = await getTicketWithMessages(id)
    if (ticket?.submittedByUserId) {
      const submitter = await rawPrisma.user.findUnique({
        where: { id: ticket.submittedByUserId },
        select: { email: true, firstName: true },
      })
      if (submitter?.email) {
        const name = submitter.firstName || 'there'
        const replyText = body.message.trim()
        const emailSubject = `Re: ${ticket.subject}`
        const emailText = [
          `Hi ${name},`,
          '',
          `The Lionheart support team replied to your ticket "${ticket.subject}":`,
          '',
          replyText,
          '',
          'You can reply to this ticket from the Help & Support menu in the app.',
          '',
          'Thanks,',
          'The Lionheart Team',
        ].join('\n')
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b;">Hi ${name},</p>
            <p style="margin: 0 0 12px; font-size: 14px; color: #64748b;">The Lionheart support team replied to your ticket <strong>&ldquo;${ticket.subject}&rdquo;</strong>:</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px; color: #1e293b; white-space: pre-wrap;">${replyText}</p>
            </div>
            <p style="margin: 0 0 4px; font-size: 13px; color: #94a3b8;">You can reply to this ticket from the Help &amp; Support menu in the app.</p>
            <p style="margin: 16px 0 0; font-size: 14px; color: #64748b;">Thanks,<br/>The Lionheart Team</p>
          </div>
        `
        const from = getResendConfig()?.from || getSmtpConfig()?.from || 'Lionheart <no-reply@lionheartapp.com>'
        sendViaResend(submitter.email, emailSubject, emailHtml, emailText, from)
          .then((r) => { if (!r.sent) return sendViaSmtp(submitter.email, emailSubject, emailHtml, emailText, from) })
          .catch((err) => logger.error({ err: String(err) }, 'Failed to send support reply email'))
      }
    }

    return NextResponse.json(ok(message), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to add support message')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
