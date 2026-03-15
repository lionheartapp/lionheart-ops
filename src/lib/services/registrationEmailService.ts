/**
 * Registration Email Service
 *
 * Confirmation emails with embedded QR code and balance-request emails.
 * Uses the existing emailService infrastructure (Resend primary, SMTP fallback).
 */

import QRCode from 'qrcode'
import { rawPrisma } from '@/lib/db'

// ─── Config ───────────────────────────────────────────────────────────────────

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
}

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

// ─── Send Helper ──────────────────────────────────────────────────────────────

type SendResult = { sent: boolean; reason?: string }

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  fromOverride?: string,
): Promise<SendResult> {
  const cfg = getResendConfig()
  const from = fromOverride ?? cfg?.from ?? getSmtpConfig()?.from ?? 'no-reply@lionheartapp.com'

  if (cfg) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      })

      if (res.ok) return { sent: true }

      const body = await res.text()
      console.error('[registrationEmailService] Resend failed:', res.status, body)
    } catch (err) {
      console.error('[registrationEmailService] Resend error:', err)
    }
  }

  const smtpCfg = getSmtpConfig()
  if (smtpCfg) {
    try {
      // Lazy import to avoid issues when nodemailer is not configured
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.default.createTransport({
        host: smtpCfg.host,
        port: smtpCfg.port,
        secure: smtpCfg.secure,
        auth: smtpCfg.auth,
      })
      await transporter.sendMail({ from, to, subject, html, text })
      return { sent: true }
    } catch (err) {
      console.error('[registrationEmailService] SMTP error:', err)
      return { sent: false, reason: 'SMTP_SEND_FAILED' }
    }
  }

  return { sent: false, reason: 'NO_EMAIL_PROVIDER_CONFIGURED' }
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

function formatEventDate(date: Date | null | undefined): string {
  if (!date) return 'TBD'
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatEventTime(date: Date | null | undefined): string {
  if (!date) return ''
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ─── Confirmation Email ────────────────────────────────────────────────────────

/**
 * Sends a registration confirmation email with an embedded QR code.
 * QR encodes the check-in URL for day-of scan.
 */
export async function sendConfirmationEmail(registrationId: string): Promise<SendResult> {
  const registration = await rawPrisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      eventProject: {
        select: {
          title: true,
          startsAt: true,
          endsAt: true,
          locationText: true,
        },
      },
      form: {
        include: {
          organization: {
            select: { name: true, logoUrl: true },
          },
        },
      },
    },
  })

  if (!registration) {
    console.error('[registrationEmailService] Registration not found:', registrationId)
    return { sent: false, reason: 'REGISTRATION_NOT_FOUND' }
  }

  const event = registration.eventProject
  const org = registration.form?.organization
  const orgName = org?.name ?? 'Your School'
  const logoUrl = org?.logoUrl

  const checkInUrl = `${getAppUrl()}/events/check-in/${registrationId}`

  // Generate QR code as data URL
  let qrDataUrl = ''
  try {
    qrDataUrl = await QRCode.toDataURL(checkInUrl, { width: 200, margin: 1 })
  } catch (err) {
    console.error('[registrationEmailService] QR generation failed:', err)
  }

  const eventTitle = event?.title ?? 'Event Registration'
  const subject = `Registration Confirmed: ${eventTitle}`

  const dateStr = formatEventDate(event?.startsAt)
  const startTime = formatEventTime(event?.startsAt)
  const endTime = formatEventTime(event?.endsAt)
  const timeStr = startTime && endTime ? `${startTime} – ${endTime}` : startTime || ''
  const location = event?.locationText ?? ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 32px;">
      ${logoUrl ? `<img src="${logoUrl}" alt="${orgName}" style="height: 40px; margin-bottom: 16px; display: block;">` : ''}
      <p style="color: #bfdbfe; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">${orgName}</p>
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">You're Registered!</h1>
      <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">${eventTitle}</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="color: #374151; margin: 0 0 8px; font-size: 15px;">
        Hi ${registration.firstName},
      </p>
      <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
        Your registration for <strong>${eventTitle}</strong> has been confirmed.
        Please save this email — you'll need the QR code below for check-in on the day of the event.
      </p>

      <!-- Event details -->
      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${dateStr ? `<tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; width: 80px;">Date</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px;">${dateStr}</td>
          </tr>` : ''}
          ${timeStr ? `<tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Time</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px;">${timeStr}</td>
          </tr>` : ''}
          ${location ? `<tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Location</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px;">${location}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Name</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px;">${registration.firstName} ${registration.lastName}</td>
          </tr>
        </table>
      </div>

      <!-- QR Code -->
      ${qrDataUrl ? `
      <div style="text-align: center; margin-bottom: 24px;">
        <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px;">Your Check-In QR Code</p>
        <img src="${qrDataUrl}" alt="Check-in QR Code" width="200" height="200" style="border: 4px solid #e5e7eb; border-radius: 8px;">
        <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0;">Present this code at the door</p>
      </div>
      ` : ''}

      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        Sent by ${orgName} via Lionheart.
        If you did not register for this event, please ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`

  const text = `Registration Confirmed: ${eventTitle}

Hi ${registration.firstName},

Your registration for ${eventTitle} has been confirmed.

Event Details:
${dateStr ? `Date: ${dateStr}\n` : ''}${timeStr ? `Time: ${timeStr}\n` : ''}${location ? `Location: ${location}\n` : ''}Name: ${registration.firstName} ${registration.lastName}

Check-in link: ${checkInUrl}

Sent by ${orgName} via Lionheart.`

  const from = `${orgName} <no-reply@lionheartapp.com>`

  return sendEmail(registration.email, subject, html, text, from)
}

// ─── Balance Request Email ─────────────────────────────────────────────────────

/**
 * Sends a balance-due email to a parent after a deposit payment.
 * Includes the payment link and remaining amount.
 */
export async function sendBalanceRequestEmail(
  registrationId: string,
  paymentLink: string,
): Promise<SendResult> {
  const registration = await rawPrisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      eventProject: {
        select: { title: true, startsAt: true },
      },
      form: {
        select: {
          basePrice: true,
          organization: {
            select: { name: true, logoUrl: true },
          },
        },
      },
      payments: {
        select: { amount: true, status: true, paymentType: true },
      },
    },
  })

  if (!registration) {
    console.error('[registrationEmailService] Registration not found:', registrationId)
    return { sent: false, reason: 'REGISTRATION_NOT_FOUND' }
  }

  const event = registration.eventProject
  const org = registration.form?.organization
  const orgName = org?.name ?? 'Your School'

  const basePrice = registration.form?.basePrice ?? 0
  const totalPaid = registration.payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)
  const balanceDue = Math.max(0, basePrice - totalPaid)
  const balanceDollars = (balanceDue / 100).toFixed(2)

  const eventTitle = event?.title ?? 'Event Registration'
  const subject = `Balance Due: ${eventTitle}`
  const dateStr = formatEventDate(event?.startsAt)

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #f59e0b; padding: 24px 32px;">
      <p style="color: #fef3c7; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">${orgName}</p>
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Balance Payment Due</h1>
      <p style="color: #fef9c3; margin: 8px 0 0; font-size: 14px;">${eventTitle}</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; margin: 0 0 8px; font-size: 15px;">Hi ${registration.firstName},</p>
      <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
        The remaining balance for <strong>${eventTitle}</strong> is now due.
        Please complete your payment to secure your spot.
      </p>

      <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #92400e; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; width: 120px;">Balance Due</td>
            <td style="padding: 6px 0; color: #b45309; font-size: 18px; font-weight: 700;">$${balanceDollars}</td>
          </tr>
          ${dateStr ? `<tr>
            <td style="padding: 6px 0; color: #92400e; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Event Date</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px;">${dateStr}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 6px 0; color: #92400e; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Name</td>
            <td style="padding: 6px 0; color: #111827; font-size: 14px;">${registration.firstName} ${registration.lastName}</td>
          </tr>
        </table>
      </div>

      <a href="${paymentLink}"
         style="display: inline-block; background: #f59e0b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 24px;">
        Pay $${balanceDollars} Now
      </a>

      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        Sent by ${orgName} via Lionheart.
        If you have questions, contact your school directly.
      </p>
    </div>
  </div>
</body>
</html>`

  const text = `Balance Due: ${eventTitle}

Hi ${registration.firstName},

The remaining balance of $${balanceDollars} for ${eventTitle} is now due.

Pay online: ${paymentLink}

Sent by ${orgName} via Lionheart.`

  const from = `${orgName} <no-reply@lionheartapp.com>`

  return sendEmail(registration.email, subject, html, text, from)
}
