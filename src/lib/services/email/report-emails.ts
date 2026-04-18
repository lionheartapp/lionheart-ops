/** Board report, compliance reminder, and contact form emails */

import nodemailer from 'nodemailer'
import { sendViaResend, sendViaSmtp, getResendConfig, getSmtpConfig, getAppUrl, type SendEmailResult } from './transport'
import { logger } from '@/lib/logger'

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

  const fciColors: Record<string, string> = { GOOD: '#059669', FAIR: '#f59e0b', POOR: '#ef4444' }
  const fciColor = fciColors[input.fciRating] ?? '#6b7280'
  const fciLabel = input.fciRating === 'GOOD' ? 'Good' : input.fciRating === 'FAIR' ? 'Fair' : 'Poor'

  const subject = `Board Facilities Report — ${input.period} — ${input.orgName}`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;"><div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><div style="background: #059669; padding: 24px 32px;"><p style="color: #d1fae5; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Lionheart Facilities Management</p><h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Board Facilities Report</h1><p style="color: #a7f3d0; margin: 4px 0 0; font-size: 14px;">${input.orgName} — ${input.period}</p></div><div style="padding: 32px;"><p style="color: #374151; margin: 0 0 16px; font-size: 15px;">Hi ${input.recipientName},</p><p style="color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">Your facilities board report for <strong>${input.period}</strong> is attached as a PDF.</p><div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;"><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; width: 160px;">Facility Condition (FCI)</td><td style="padding: 6px 0;"><span style="display: inline-block; background: ${fciColor}20; color: ${fciColor}; padding: 2px 10px; border-radius: 9999px; font-size: 13px; font-weight: 700;">${fciLabel}</span></td></tr><tr><td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase;">Open Work Orders</td><td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">${input.backlogCount} tickets</td></tr></table></div><a href="${input.appUrl || getAppUrl()}/maintenance/board-report" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">View Live Dashboard</a></div></div></body></html>`

  const text = `Board Facilities Report — ${input.orgName} — ${input.period}\n\nFCI Rating: ${fciLabel}\nOpen Work Orders: ${input.backlogCount}\n\nView: ${input.appUrl || getAppUrl()}/maintenance/board-report`

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

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;"><div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><div style="background: #4f46e5; padding: 24px 32px;"><p style="color: #c7d2fe; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Contact Form Submission</p><h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">New Message from ${input.name}</h1></div><div style="padding: 32px;"><table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;"><tr><td style="padding: 8px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; width: 100px; vertical-align: top;">Name</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${input.name}</td></tr><tr><td style="padding: 8px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; vertical-align: top;">Email</td><td style="padding: 8px 0;"><a href="mailto:${input.email}" style="color: #4f46e5; font-size: 14px;">${input.email}</a></td></tr></table><div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;"><p style="color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; margin: 0 0 8px;">Message</p><p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${input.message}</p></div></div></div></body></html>`
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
  const urgencyColor = isUrgent ? '#ef4444' : '#f59e0b'
  const urgencyLabel = isUrgent ? `URGENT: ${input.daysUntilDue} days remaining` : `${input.daysUntilDue} days remaining`
  const subject = isUrgent
    ? `URGENT: ${input.domain} compliance due in ${input.daysUntilDue} days — ${input.orgName}`
    : `Compliance Reminder: ${input.domain} due in ${input.daysUntilDue} days — ${input.orgName}`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;"><div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"><div style="background: #059669; padding: 24px 32px;"><p style="color: #d1fae5; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">Lionheart Compliance</p><h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">${input.orgName}</h1></div><div style="padding: 32px;"><div style="background: ${urgencyColor}10; border: 1px solid ${urgencyColor}30; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;"><p style="color: ${urgencyColor}; margin: 0; font-size: 14px; font-weight: 600;">${urgencyLabel}</p></div><p style="color: #374151; margin: 0 0 8px; font-size: 15px;">Hi ${input.recipientName || 'there'},</p><p style="color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">A compliance deadline is approaching for <strong>${input.orgName}</strong>.</p><div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;"><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; width: 120px;">Domain</td><td style="padding: 6px 0; color: #111827; font-size: 14px; font-weight: 600;">${input.domain}</td></tr><tr><td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase;">Inspection</td><td style="padding: 6px 0; color: #111827; font-size: 14px;">${input.recordTitle}</td></tr><tr><td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase;">Due Date</td><td style="padding: 6px 0; color: ${urgencyColor}; font-size: 14px; font-weight: 700;">${input.dueDate}</td></tr></table></div><a href="${input.complianceLink}" style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">View Compliance Calendar</a></div></div></body></html>`
  const text = `Compliance Reminder — ${input.orgName}\n\nDomain: ${input.domain}\nInspection: ${input.recordTitle}\nDue: ${input.dueDate}\nDays: ${input.daysUntilDue}\n\nView: ${input.complianceLink}`

  const from = getResendConfig()?.from || getSmtpConfig()?.from || 'Lionheart <no-reply@lionheartapp.com>'
  const resendResult = await sendViaResend(input.to, subject, html, text, from)
  if (resendResult.sent) return resendResult
  const smtpResult = await sendViaSmtp(input.to, subject, html, text, from)
  if (smtpResult.sent) return smtpResult
  return { sent: false, reason: 'NO_EMAIL_PROVIDER_CONFIGURED' }
}
