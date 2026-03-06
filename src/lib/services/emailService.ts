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
