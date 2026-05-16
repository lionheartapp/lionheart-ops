/** Board report, compliance reminder, and contact form emails */

import nodemailer from 'nodemailer'
import { sendViaResend, sendViaSmtp, getResendConfig, getSmtpConfig, getAppUrl, type SendEmailResult } from './transport'
import { logger } from '@/lib/logger'
import { wrapInlineLayout, inlineHero, inlineCta, inlineKvCard, inlineCard, inlinePill, inlineMicro } from '@/lib/email/inline-layout'

const log = logger.child({ service: 'reportEmails' })

// ─── Board Report Email ──────────────────────────────────────────────

type BoardReportEmailInput = {
  to: string
  recipientName: string
  orgName: string
  period: string
  fciRating: string
  backlogCount: number
  pdfBuffer: Buffer
  appUrl?: string
}

export async function sendBoardReportEmail(
  input: BoardReportEmailInput
): Promise<{ sent: boolean; reason?: string }> {
  const from = getResendConfig()?.from || getSmtpConfig()?.from || 'Lionheart <no-reply@lionheartapp.com>'

  const fciLabel = input.fciRating === 'GOOD' ? 'Good' : input.fciRating === 'FAIR' ? 'Fair' : 'Poor'
  const fciVariant: 'green' | 'amber' | 'red' | 'gray' =
    input.fciRating === 'GOOD' ? 'green' : input.fciRating === 'FAIR' ? 'amber' : input.fciRating === 'POOR' ? 'red' : 'gray'

  const subject = `Board Facilities Report — ${input.period} — ${input.orgName}`
  const appUrl = input.appUrl || getAppUrl()

  const html = wrapInlineLayout({
    appUrl,
    content: [
      inlineHero(
        'Board report',
        `${input.period} in numbers.`,
        `Hi ${input.recipientName} — here's the facilities summary for <strong style="color:#0f0f0f;">${input.orgName}</strong>. The full report is attached as a PDF.`
      ),
      inlineKvCard([
        ['Facility condition (FCI)', inlinePill(fciLabel, fciVariant)],
        ['Open work orders', `${input.backlogCount} tickets`],
        ['Period', input.period],
      ]),
      inlineCta('Open live dashboard', `${appUrl}/maintenance/board-report`),
    ].join(''),
  })

  const text = `Board Facilities Report — ${input.orgName} — ${input.period}\n\nFCI Rating: ${fciLabel}\nOpen Work Orders: ${input.backlogCount}\n\nView: ${appUrl}/maintenance/board-report`

  const cfg = getResendConfig()
  if (cfg) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: cfg.from, to: [input.to], subject, text, html,
          attachments: [{ filename: `board-report-${input.period.replace(/\s/g, '-').toLowerCase()}.pdf`, content: input.pdfBuffer.toString('base64') }],
        }),
      })
      if (res.ok) return { sent: true }
      log.error({ status: res.status, body: await res.text() }, 'Resend board report failed')
    } catch (err) {
      log.error({ err: String(err) }, 'Resend board report error')
    }
  }

  const smtpCfg = getSmtpConfig()
  if (smtpCfg) {
    try {
      const transporter = nodemailer.createTransport({ host: smtpCfg.host, port: smtpCfg.port, secure: smtpCfg.secure, auth: smtpCfg.auth })
      await transporter.sendMail({
        from: smtpCfg.from, to: input.to, subject, text, html,
        attachments: [{ filename: `board-report-${input.period.replace(/\s/g, '-').toLowerCase()}.pdf`, content: input.pdfBuffer, contentType: 'application/pdf' }],
      })
      return { sent: true }
    } catch (err) {
      log.error({ err: String(err) }, 'SMTP board report error')
      return { sent: false, reason: 'SMTP_SEND_FAILED' }
    }
  }

  return { sent: false, reason: 'NO_EMAIL_PROVIDER_CONFIGURED' }
}

// ─── Contact Form Email ──────────────────────────────────────────────

type ContactFormEmailInput = { name: string; email: string; subject?: string; message: string }

export async function sendContactFormEmail(input: ContactFormEmailInput): Promise<SendEmailResult> {
  const to = process.env.CONTACT_EMAIL || process.env.MAIL_FROM || 'no-reply@lionheartapp.com'
  const from = process.env.MAIL_FROM || 'Lionheart <no-reply@lionheartapp.com>'
  const subject = `[Lionheart Contact] ${input.subject || 'New Message'} from ${input.name}`

  const escapedMessage = input.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  const appUrl = getAppUrl()
  const html = wrapInlineLayout({
    appUrl,
    content: [
      inlineHero(
        'New inquiry',
        'Someone wants to talk to you.',
        `A new contact form was just submitted from <strong style="color:#0f0f0f;">lionheartapp.com</strong>.`
      ),
      inlineKvCard([
        ['Name', input.name],
        ['Email', `<a href="mailto:${input.email}" style="color:#0f0f0f;">${input.email}</a>`],
        ...(input.subject ? [['Subject', input.subject] as const] : []),
      ]),
      inlineCard(
        `<div style="font-size:11px;font-weight:600;color:#9a9a9a;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Message</div><div style="font-size:14.5px;color:#0f0f0f;line-height:1.6;">${escapedMessage}</div>`
      ),
      inlineCta('Reply in dashboard', `${appUrl}/admin/support`),
    ].join(''),
  })
  const text = `New contact form message from ${input.name} <${input.email}>\n${input.subject ? `Subject: ${input.subject}\n` : ''}\nMessage:\n${input.message}`

  const resendResult = await sendViaResend(to, subject, html, text, from)
  if (resendResult.sent) return resendResult
  const smtpResult = await sendViaSmtp(to, subject, html, text, from)
  if (smtpResult.sent) return smtpResult
  return { sent: false, reason: 'NO_EMAIL_PROVIDER_CONFIGURED' }
}

// ─── Compliance Reminder Email ───────────────────────────────────────

type ComplianceReminderEmailInput = {
  to: string; recipientName: string; domain: string; recordTitle: string
  dueDate: string; daysUntilDue: number; orgName: string; complianceLink: string
}

export async function sendComplianceReminderEmail(input: ComplianceReminderEmailInput): Promise<SendEmailResult> {
  const isUrgent = input.daysUntilDue <= 7
  const variant: 'red' | 'amber' = isUrgent ? 'red' : 'amber'
  const subject = isUrgent
    ? `URGENT: ${input.domain} compliance due in ${input.daysUntilDue} days — ${input.orgName}`
    : `Compliance Reminder: ${input.domain} due in ${input.daysUntilDue} days — ${input.orgName}`

  const appUrl = getAppUrl()
  const eyebrow = isUrgent ? 'Urgent · compliance' : 'Compliance'
  const headline = isUrgent
    ? `${input.daysUntilDue} days left.`
    : `Heads up — ${input.domain.toLowerCase()} due soon.`
  const lede = `Hi ${input.recipientName || 'there'} — a compliance deadline is approaching for <strong style="color:#0f0f0f;">${input.orgName}</strong>.`

  const cardBg = isUrgent ? '#fef2f2' : '#fffbeb'
  const cardBorder = isUrgent ? '#fecaca' : '#fde68a'

  const html = wrapInlineLayout({
    appUrl,
    content: [
      inlineHero(eyebrow, headline, lede),
      inlineKvCard(
        [
          ['Domain', input.domain],
          ['Inspection', input.recordTitle],
          ['Due', input.dueDate],
          ['Status', inlinePill(`${input.daysUntilDue} days remaining`, variant)],
        ],
        cardBg,
        cardBorder
      ),
      inlineCta('Open compliance calendar', input.complianceLink),
    ].join(''),
  })
  const text = `Compliance Reminder — ${input.orgName}\n\nDomain: ${input.domain}\nInspection: ${input.recordTitle}\nDue: ${input.dueDate}\nDays: ${input.daysUntilDue}\n\nView: ${input.complianceLink}`

  const from = getResendConfig()?.from || getSmtpConfig()?.from || 'Lionheart <no-reply@lionheartapp.com>'
  const resendResult = await sendViaResend(input.to, subject, html, text, from)
  if (resendResult.sent) return resendResult
  const smtpResult = await sendViaSmtp(input.to, subject, html, text, from)
  if (smtpResult.sent) return smtpResult
  return { sent: false, reason: 'NO_EMAIL_PROVIDER_CONFIGURED' }
}
