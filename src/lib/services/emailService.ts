import nodemailer from 'nodemailer'
import { renderEmail, type EmailTemplate } from '@/lib/email/templates'

// ─── Types ────────────────────────────────────────────────────────────

type SendEmailResult = {
  sent: boolean
  reason?: string
}

type WelcomeEmailInput = {
  to: string
  firstName: string
  organizationName: string
  setupLink: string
  expiresAtIso: string
  mode: 'ADMIN_CREATE' | 'INVITE_ONLY'
}

type EventUpdateEmailInput = {
  eventTitle: string
  eventStart: string
  eventEnd: string
  attendeeEmails: string[]
  updatedByName: string
  orgName: string
  appUrl?: string
  eventLink?: string
}

type EventNotifyEmailInput = {
  to: string
  eventTitle: string
  orgName: string
  appUrl?: string
  eventLink?: string
}

type EventApprovedEmailInput = EventNotifyEmailInput & {
  channelName: string
}

type EventRejectedEmailInput = EventNotifyEmailInput & {
  reason?: string
}

type EventInviteEmailInput = EventNotifyEmailInput & {
  eventDate?: string
  eventTime?: string
}

// ─── Config ───────────────────────────────────────────────────────────

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'Lionheart <no-reply@lionheartapp.com>'
  if (!apiKey) return null
  return { apiKey, from }
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const portRaw = process.env.SMTP_PORT?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'Lionheart <no-reply@lionheartapp.com>'

  if (!host || !portRaw || !user || !pass) return null

  const port = Number(portRaw)
  if (!Number.isFinite(port)) return null

  const secure = process.env.SMTP_SECURE === 'true' || port === 465
  return { host, port, secure, auth: { user, pass }, from }
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
}

// ─── Generic Send ─────────────────────────────────────────────────────

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  from: string
): Promise<SendEmailResult> {
  const cfg = getResendConfig()
  if (!cfg) return { sent: false, reason: 'RESEND_NOT_CONFIGURED' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || cfg.from,
        to: [to],
        subject,
        text,
        html,
      }),
    })

    if (!res.ok) {
      const bodyText = await res.text()
      console.error('Resend send failed:', res.status, bodyText)
      return { sent: false, reason: 'RESEND_SEND_FAILED' }
    }

    return { sent: true }
  } catch (error) {
    console.error('Resend send error:', error)
    return { sent: false, reason: 'RESEND_SEND_FAILED' }
  }
}

async function sendViaSmtp(
  to: string,
  subject: string,
  html: string,
  text: string,
  from: string
): Promise<SendEmailResult> {
  const cfg = getSmtpConfig()
  if (!cfg) return { sent: false, reason: 'SMTP_NOT_CONFIGURED' }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  })

  try {
    await transporter.sendMail({ from: from || cfg.from, to, subject, text, html })
    return { sent: true }
  } catch (error) {
    console.error('Failed to send email via SMTP:', error)
    return { sent: false, reason: 'SMTP_SEND_FAILED' }
  }
}

/** Send a branded email using Resend (primary) with SMTP fallback. */
async function sendBrandedEmail(
  template: EmailTemplate,
  to: string,
  vars: Record<string, string | undefined>
): Promise<SendEmailResult> {
  const from = getResendConfig()?.from || getSmtpConfig()?.from || 'no-reply@lionheartapp.com'
  const { html, subject, text } = renderEmail(template, vars)

  const resendResult = await sendViaResend(to, subject, html, text, from)
  if (resendResult.sent) return resendResult

  const smtpResult = await sendViaSmtp(to, subject, html, text, from)
  if (smtpResult.sent) return smtpResult

  if (resendResult.reason === 'RESEND_SEND_FAILED') return resendResult
  if (smtpResult.reason === 'SMTP_SEND_FAILED') return smtpResult
  if (resendResult.reason === 'RESEND_NOT_CONFIGURED' && smtpResult.reason === 'SMTP_NOT_CONFIGURED') {
    return { sent: false, reason: 'NO_EMAIL_PROVIDER_CONFIGURED' }
  }

  return { sent: false, reason: smtpResult.reason || resendResult.reason || 'EMAIL_SEND_FAILED' }
}

// ─── Password Reset ───────────────────────────────────────────────────

type PasswordResetEmailInput = {
  to: string
  firstName: string
  orgName: string
  resetLink: string
}

export async function sendPasswordResetEmail(input: PasswordResetEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('password_reset', input.to, {
    firstName: input.firstName,
    orgName: input.orgName,
    resetLink: input.resetLink,
    appUrl: getAppUrl(),
  })
}

// ─── Welcome / Password Setup ─────────────────────────────────────────

export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<SendEmailResult> {
  const expiresAt = new Date(input.expiresAtIso)
  const template: EmailTemplate = input.mode === 'ADMIN_CREATE' ? 'welcome' : 'password_setup'

  return sendBrandedEmail(template, input.to, {
    firstName: input.firstName,
    orgName: input.organizationName,
    setupLink: input.setupLink,
    expiresAt: expiresAt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
    appUrl: getAppUrl(),
  })
}

// ─── Event Update (Reschedule) ────────────────────────────────────────

export async function sendEventUpdateEmails(input: EventUpdateEmailInput): Promise<void> {
  if (input.attendeeEmails.length === 0) return

  const startDate = new Date(input.eventStart)
  const endDate = new Date(input.eventEnd)
  const dateStr = startDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const startStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const vars = {
    eventTitle: input.eventTitle,
    eventDate: dateStr,
    eventTime: `${startStr} – ${endStr}`,
    updatedByName: input.updatedByName,
    orgName: input.orgName,
    appUrl: input.appUrl || getAppUrl(),
    eventLink: input.eventLink || getAppUrl(),
  }

  for (const email of input.attendeeEmails) {
    sendBrandedEmail('event_updated', email, vars).catch((err) => {
      console.error(`Failed to send event update email to ${email}:`, err)
    })
  }
}

// ─── Event Approved ───────────────────────────────────────────────────

export async function sendEventApprovedEmail(input: EventApprovedEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('event_approved', input.to, {
    eventTitle: input.eventTitle,
    channelName: input.channelName,
    orgName: input.orgName,
    appUrl: input.appUrl || getAppUrl(),
    eventLink: input.eventLink || getAppUrl(),
  })
}

// ─── Event Rejected ───────────────────────────────────────────────────

export async function sendEventRejectedEmail(input: EventRejectedEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('event_rejected', input.to, {
    eventTitle: input.eventTitle,
    reason: input.reason,
    orgName: input.orgName,
    appUrl: input.appUrl || getAppUrl(),
    eventLink: input.eventLink || getAppUrl(),
  })
}

// ─── Event Cancelled ──────────────────────────────────────────────────

export async function sendEventCancelledEmail(input: EventNotifyEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('event_cancelled', input.to, {
    eventTitle: input.eventTitle,
    orgName: input.orgName,
    appUrl: input.appUrl || getAppUrl(),
    eventLink: input.eventLink || getAppUrl(),
  })
}

// ─── Event Invite ─────────────────────────────────────────────────────

export async function sendEventInviteEmail(input: EventInviteEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('event_invite', input.to, {
    eventTitle: input.eventTitle,
    eventDate: input.eventDate,
    eventTime: input.eventTime,
    orgName: input.orgName,
    appUrl: input.appUrl || getAppUrl(),
    eventLink: input.eventLink || getAppUrl(),
  })
}

// ─── Maintenance Emails ────────────────────────────────────────────────────────

type MaintenanceEmailBase = {
  to: string
  ticketNumber: string
  ticketTitle: string
  ticketLink: string
  orgName?: string
}

type MaintenanceAssignedEmailInput = MaintenanceEmailBase & {
  priority: string
  category: string
}

type MaintenanceInProgressEmailInput = MaintenanceEmailBase & {
  technicianName: string
}

type MaintenanceOnHoldEmailInput = MaintenanceEmailBase & {
  holdReason: string
}

type MaintenanceQAReadyEmailInput = MaintenanceEmailBase & {
  technicianName: string
}

type MaintenanceUrgentEmailInput = MaintenanceEmailBase & {
  priority: string
  category: string
  location?: string
}

type MaintenanceStaleEmailInput = MaintenanceEmailBase & {
  priority: string
  ticketAge: string
}

type MaintenanceClaimedEmailInput = MaintenanceEmailBase & {
  technicianName: string
}

type MaintenanceQARejectedEmailInput = MaintenanceEmailBase & {
  rejectionNote: string
}

export async function sendMaintenanceSubmittedEmail(
  input: MaintenanceAssignedEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_submitted', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    priority: input.priority,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendMaintenanceAssignedEmail(
  input: MaintenanceAssignedEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_assigned', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    priority: input.priority,
    category: input.category,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendMaintenanceClaimedEmail(
  input: MaintenanceClaimedEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_claimed', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    technicianName: input.technicianName,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendMaintenanceInProgressEmail(
  input: MaintenanceInProgressEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_in_progress', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    technicianName: input.technicianName,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendMaintenanceOnHoldEmail(
  input: MaintenanceOnHoldEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_on_hold', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    holdReason: input.holdReason,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendMaintenanceQAReadyEmail(
  input: MaintenanceQAReadyEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_qa_ready', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    technicianName: input.technicianName,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendMaintenanceDoneEmail(
  input: MaintenanceEmailBase
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_done', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendMaintenanceUrgentEmail(
  input: MaintenanceUrgentEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_urgent', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    priority: input.priority,
    category: input.category,
    location: input.location,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendMaintenanceStaleEmail(
  input: MaintenanceStaleEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_stale', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    priority: input.priority,
    ticketAge: input.ticketAge,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendMaintenanceQARejectedEmail(
  input: MaintenanceQARejectedEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_qa_rejected', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    rejectionNote: input.rejectionNote,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

// ─── Maintenance Asset Intelligence Alert Emails ───────────────────────────────

type RepeatRepairAlertInput = {
  to: string
  assetName: string
  assetNumber: string
  repairCount: number
  assetUrl: string
}

type CostThresholdAlertInput = {
  to: string
  assetName: string
  assetNumber: string
  cumulativeCost: number
  replacementCost: number
  pct: number
  recommendation: string
  assetUrl: string
}

type EndOfLifeAlertInput = {
  to: string
  assetName: string
  assetNumber: string
  purchaseYear: string
  expectedLifespan: number
  assetUrl: string
}

export async function sendRepeatRepairAlertEmail(
  input: RepeatRepairAlertInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_repeat_repair', input.to, {
    assetName: input.assetName,
    assetNumber: input.assetNumber,
    repairCount: String(input.repairCount),
    assetUrl: input.assetUrl,
    appUrl: getAppUrl(),
  })
}

export async function sendCostThresholdAlertEmail(
  input: CostThresholdAlertInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_cost_threshold', input.to, {
    assetName: input.assetName,
    assetNumber: input.assetNumber,
    cumulativeCost: input.cumulativeCost.toFixed(2),
    replacementCost: input.replacementCost.toFixed(2),
    pct: Math.round(input.pct * 100).toString(),
    recommendation: input.recommendation,
    assetUrl: input.assetUrl,
    appUrl: getAppUrl(),
  })
}

export async function sendEndOfLifeAlertEmail(
  input: EndOfLifeAlertInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_end_of_life', input.to, {
    assetName: input.assetName,
    assetNumber: input.assetNumber,
    purchaseYear: input.purchaseYear,
    expectedLifespan: String(input.expectedLifespan),
    assetUrl: input.assetUrl,
    appUrl: getAppUrl(),
  })
}

// ─── IT Help Desk Emails ──────────────────────────────────────────────────────

type ITEmailBase = {
  to: string
  ticketNumber: string
  ticketTitle: string
  ticketLink: string
}

type ITAssignedEmailInput = ITEmailBase & {
  priority: string
  category: string
}

type ITUrgentEmailInput = ITEmailBase & {
  category: string
  location?: string
}

export async function sendITTicketSubmittedEmail(
  input: ITEmailBase & { category: string }
): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_submitted', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    category: input.category,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendITTicketAssignedEmail(
  input: ITAssignedEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_assigned', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    priority: input.priority,
    category: input.category,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendITTicketInProgressEmail(
  input: ITEmailBase
): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_in_progress', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendITTicketOnHoldEmail(
  input: ITEmailBase
): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_on_hold', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendITTicketDoneEmail(
  input: ITEmailBase
): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_done', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

export async function sendITTicketUrgentEmail(
  input: ITUrgentEmailInput
): Promise<SendEmailResult> {
  return sendBrandedEmail('it_ticket_urgent', input.to, {
    ticketNumber: input.ticketNumber,
    ticketTitle: input.ticketTitle,
    category: input.category,
    location: input.location,
    ticketLink: input.ticketLink,
    appUrl: getAppUrl(),
  })
}

// ─── Board Report Email ────────────────────────────────────────────────────────

type BoardReportEmailInput = {
  to: string
  recipientName: string
  orgName: string
  period: string        // e.g. "March 2026" or "Feb 28 – Mar 6, 2026"
  fciRating: string     // "GOOD" | "FAIR" | "POOR"
  backlogCount: number
  pdfBuffer: Buffer
  appUrl?: string
}

export async function sendBoardReportEmail(
  input: BoardReportEmailInput
): Promise<{ sent: boolean; reason?: string }> {
  const from =
    getResendConfig()?.from ||
    getSmtpConfig()?.from ||
    'Lionheart <no-reply@lionheartapp.com>'

  const fciColors: Record<string, string> = {
    GOOD: '#059669',
    FAIR: '#f59e0b',
    POOR: '#ef4444',
  }
  const fciColor = fciColors[input.fciRating] ?? '#6b7280'
  const fciLabel = input.fciRating === 'GOOD' ? 'Good' : input.fciRating === 'FAIR' ? 'Fair' : 'Poor'

  const subject = `Board Facilities Report — ${input.period} — ${input.orgName}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #059669; padding: 24px 32px;">
      <p style="color: #d1fae5; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Lionheart Facilities Management</p>
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Board Facilities Report</h1>
      <p style="color: #a7f3d0; margin: 4px 0 0; font-size: 14px;">${input.orgName} — ${input.period}</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; margin: 0 0 16px; font-size: 15px;">Hi ${input.recipientName},</p>
      <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
        Your facilities board report for <strong>${input.period}</strong> is attached as a PDF. Here is a quick summary:
      </p>

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; width: 160px;">Facility Condition (FCI)</td>
            <td style="padding: 6px 0;">
              <span style="display: inline-block; background: ${fciColor}20; color: ${fciColor}; padding: 2px 10px; border-radius: 9999px; font-size: 13px; font-weight: 700;">${fciLabel}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Open Work Orders</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">${input.backlogCount} tickets</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Report Period</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px;">${input.period}</td>
          </tr>
        </table>
      </div>

      <p style="color: #6b7280; font-size: 13px; margin: 0 0 24px; line-height: 1.6;">
        The full report with compliance status, asset intelligence, and year-over-year comparison is attached.
      </p>

      <a href="${input.appUrl || getAppUrl()}/maintenance/board-report" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 24px;">View Live Dashboard</a>

      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        This report was automatically generated by Lionheart Facilities Management for ${input.orgName}.
      </p>
    </div>
  </div>
</body>
</html>`

  const text = `Board Facilities Report — ${input.orgName} — ${input.period}\n\nFCI Rating: ${fciLabel}\nOpen Work Orders: ${input.backlogCount}\n\nThe full report is attached as a PDF.\n\nView live dashboard: ${input.appUrl || getAppUrl()}/maintenance/board-report`

  // Try Resend with attachment
  const cfg = getResendConfig()
  if (cfg) {
    try {
      const formData = new FormData()
      // Resend API v1 supports attachments via JSON body
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: cfg.from,
          to: [input.to],
          subject,
          text,
          html,
          attachments: [
            {
              filename: `board-report-${input.period.replace(/\s/g, '-').toLowerCase()}.pdf`,
              content: input.pdfBuffer.toString('base64'),
            },
          ],
        }),
      })
      if (res.ok) return { sent: true }
      const bodyText = await res.text()
      console.error('Resend board report send failed:', res.status, bodyText)
    } catch (err) {
      console.error('Resend board report send error:', err)
    }
  }

  // Try SMTP with attachment
  const smtpCfg = getSmtpConfig()
  if (smtpCfg) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpCfg.host,
        port: smtpCfg.port,
        secure: smtpCfg.secure,
        auth: smtpCfg.auth,
      })
      await transporter.sendMail({
        from: smtpCfg.from,
        to: input.to,
        subject,
        text,
        html,
        attachments: [
          {
            filename: `board-report-${input.period.replace(/\s/g, '-').toLowerCase()}.pdf`,
            content: input.pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      })
      return { sent: true }
    } catch (err) {
      console.error('SMTP board report send error:', err)
      return { sent: false, reason: 'SMTP_SEND_FAILED' }
    }
  }

  return { sent: false, reason: 'NO_EMAIL_PROVIDER_CONFIGURED' }
}

// ─── Compliance Reminder Email ─────────────────────────────────────────────────

type ComplianceReminderEmailInput = {
  to: string
  recipientName: string
  domain: string
  recordTitle: string
  dueDate: string
  daysUntilDue: number
  orgName: string
  complianceLink: string
}

export async function sendComplianceReminderEmail(
  input: ComplianceReminderEmailInput
): Promise<SendEmailResult> {
  const isUrgent = input.daysUntilDue <= 7
  const urgencyColor = isUrgent ? '#ef4444' : '#f59e0b'
  const urgencyLabel = isUrgent ? `URGENT: ${input.daysUntilDue} days remaining` : `${input.daysUntilDue} days remaining`

  const subject = isUrgent
    ? `URGENT: ${input.domain} compliance due in ${input.daysUntilDue} days — ${input.orgName}`
    : `Compliance Reminder: ${input.domain} due in ${input.daysUntilDue} days — ${input.orgName}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #059669; padding: 24px 32px;">
      <p style="color: #d1fae5; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Lionheart Compliance</p>
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">${input.orgName}</h1>
    </div>
    <div style="padding: 32px;">
      <div style="background: ${urgencyColor}10; border: 1px solid ${urgencyColor}30; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
        <p style="color: ${urgencyColor}; margin: 0; font-size: 14px; font-weight: 600;">${urgencyLabel}</p>
      </div>

      <p style="color: #374151; margin: 0 0 8px; font-size: 15px;">Hi ${input.recipientName || 'there'},</p>
      <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
        This is a reminder that a compliance deadline is approaching for <strong>${input.orgName}</strong>.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; width: 120px;">Domain</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">${input.domain}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Inspection</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px;">${input.recordTitle}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Due Date</td>
            <td style="padding: 6px 0; color: ${urgencyColor}; font-size: 14px; font-weight: 700;">${input.dueDate}</td>
          </tr>
        </table>
      </div>

      <a href="${input.complianceLink}" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 24px;">View Compliance Calendar</a>

      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        You are receiving this because you are listed as a Maintenance Head or Administrator for ${input.orgName}.
        Manage notifications in your account settings.
      </p>
    </div>
  </div>
</body>
</html>`

  const text = `Compliance Reminder — ${input.orgName}\n\nDomain: ${input.domain}\nInspection: ${input.recordTitle}\nDue Date: ${input.dueDate}\nDays Remaining: ${input.daysUntilDue}\n\nView your compliance calendar: ${input.complianceLink}`

  const from = getResendConfig()?.from || getSmtpConfig()?.from || 'Lionheart <no-reply@lionheartapp.com>'

  const resendResult = await sendViaResend(input.to, subject, html, text, from)
  if (resendResult.sent) return resendResult
  const smtpResult = await sendViaSmtp(input.to, subject, html, text, from)
  if (smtpResult.sent) return smtpResult
  return { sent: false, reason: 'NO_EMAIL_PROVIDER_CONFIGURED' }
}
