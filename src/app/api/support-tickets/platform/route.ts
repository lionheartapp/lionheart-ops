import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { createSupportTicket, listOrgSupportTickets } from '@/lib/services/platformSupportService'
import { sendViaResend, sendViaSmtp, getResendConfig, getSmtpConfig, getAppUrl } from '@/lib/services/email/transport'
import { PlatformTicketStatus } from '@prisma/client'
import { logger } from '@/lib/logger'
import { can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const SUPPORT_NOTIFY_EMAIL = 'mkerley@lionheartapp.com'

/**
 * @authOnly Users can create support tickets and read their own; workspace managers can read all org support tickets.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const perPage = Math.min(50, parseInt(url.searchParams.get('perPage') || '20'))
    const status = url.searchParams.get('status') as PlatformTicketStatus | null
    const canManageWorkspace = await can(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

    const result = await listOrgSupportTickets(orgId, {
      status: status || undefined,
      submittedByUserId: canManageWorkspace ? undefined : ctx.userId,
      page,
      perPage,
    })

    return NextResponse.json(ok(result))
  } catch (error) {
    logger.error({ error: String(error) }, 'Failed to list support tickets')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const body = await req.json()
    const { subject, description, category, priority } = body

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json(fail('BAD_REQUEST', 'subject and description are required'), { status: 400 })
    }

    const ticket = await createSupportTicket({
      organizationId: orgId,
      submittedByUserId: ctx.userId,
      subject: subject.trim(),
      description: description.trim(),
      category: category || undefined,
      priority: priority || undefined,
    })

    // Fire-and-forget email notification to platform support
    const orgName = ticket.organization?.name || 'Unknown org'
    const appUrl = getAppUrl()
    const ticketUrl = `${appUrl}/admin/support/${ticket.id}`
    const emailSubject = `[Support] ${category === 'BUG' ? 'Bug Report' : 'Support Ticket'}: ${subject.trim()}`
    const emailText = [
      `New ${category === 'BUG' ? 'bug report' : 'support ticket'} from ${orgName} (${ctx.email})`,
      '',
      `Subject: ${subject.trim()}`,
      '',
      description.trim(),
      '',
      `View in admin: ${ticketUrl}`,
    ].join('\n')
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 4px; font-size: 18px; color: #1e293b;">${category === 'BUG' ? 'Bug Report' : 'Support Ticket'}</h2>
        <p style="margin: 0 0 20px; font-size: 14px; color: #64748b;">From <strong>${orgName}</strong> &middot; ${ctx.email}</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px; font-size: 15px; font-weight: 600; color: #1e293b;">${subject.trim()}</p>
          <p style="margin: 0; font-size: 14px; color: #475569; white-space: pre-wrap;">${description.trim()}</p>
        </div>
        <a href="${ticketUrl}" style="display: inline-block; padding: 10px 20px; background: #0f172a; color: #fff; text-decoration: none; border-radius: 9999px; font-size: 14px; font-weight: 500;">View in Admin Portal</a>
      </div>
    `
    const from = getResendConfig()?.from || getSmtpConfig()?.from || 'Lionheart <no-reply@lionheartapp.com>'
    sendViaResend(SUPPORT_NOTIFY_EMAIL, emailSubject, emailHtml, emailText, from)
      .then((r) => { if (!r.sent) return sendViaSmtp(SUPPORT_NOTIFY_EMAIL, emailSubject, emailHtml, emailText, from) })
      .catch((err) => logger.error({ err: String(err) }, 'Failed to send support notification email'))

    return NextResponse.json(ok(ticket), { status: 201 })
  } catch (error) {
    logger.error({ error: String(error) }, 'Failed to create support ticket')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
