/**
 * Email Transport Layer
 *
 * Shared infrastructure for sending emails via Resend (primary) or SMTP (fallback).
 * Domain-specific email modules import sendBrandedEmail from here.
 */

import nodemailer from 'nodemailer'
import { renderEmail, type EmailTemplate } from '@/lib/email/templates'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'emailService' })

// ─── Types ────────────────────────────────────────────────────────────

export type SendEmailResult = {
  sent: boolean
  reason?: string
}

// ─── Config ───────────────────────────────────────────────────────────

export function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'Lionheart <no-reply@lionheartapp.com>'
  if (!apiKey) return null
  return { apiKey, from }
}

export function getSmtpConfig() {
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

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
}

// ─── Generic Send ─────────────────────────────────────────────────────

export async function sendViaResend(
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
      log.error({ status: res.status, body: bodyText }, 'Resend send failed')
      return { sent: false, reason: 'RESEND_SEND_FAILED' }
    }

    return { sent: true }
  } catch (error) {
    log.error({ err: String(error) }, 'Resend send error')
    return { sent: false, reason: 'RESEND_SEND_FAILED' }
  }
}

export async function sendViaSmtp(
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
    log.error({ err: String(error) }, 'Failed to send email via SMTP')
    return { sent: false, reason: 'SMTP_SEND_FAILED' }
  }
}

/** Send a branded email using Resend (primary) with SMTP fallback. */
export async function sendBrandedEmail(
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
