import nodemailer from 'nodemailer'

type WelcomeEmailInput = {
  to: string
  firstName: string
  organizationName: string
  setupLink: string
  expiresAtIso: string
  mode: 'ADMIN_CREATE' | 'INVITE_ONLY'
}

type SendEmailResult = {
  sent: boolean
  reason?: string
}

type EmailContent = {
  from: string
  to: string
  subject: string
  text: string
  html: string
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'no-reply@lionheartapp.com'
  if (!apiKey) return null
  return { apiKey, from }
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const portRaw = process.env.SMTP_PORT?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'no-reply@lionheartapp.com'

  if (!host || !portRaw || !user || !pass) {
    return null
  }

  const port = Number(portRaw)
  if (!Number.isFinite(port)) {
    return null
  }

  const secure = process.env.SMTP_SECURE === 'true' || port === 465

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    from,
  }
}

function buildWelcomeEmail(input: WelcomeEmailInput, from: string): EmailContent {
  const expiresAt = new Date(input.expiresAtIso)
  const subject = input.mode === 'ADMIN_CREATE'
    ? `Welcome to ${input.organizationName}`
    : `Complete your invitation to ${input.organizationName}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 12px;">Welcome, ${input.firstName}</h2>
      <p style="line-height: 1.5; margin: 0 0 12px;">
        ${input.mode === 'ADMIN_CREATE'
          ? `Your account at <strong>${input.organizationName}</strong> is active. Set your password to get started.`
          : `You've been invited to <strong>${input.organizationName}</strong>. Set your password to complete setup.`}
      </p>
      <p style="margin: 20px 0;">
        <a href="${input.setupLink}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;">Set Password</a>
      </p>
      <p style="font-size: 12px; color: #6b7280; line-height: 1.5;">
        This link expires on ${expiresAt.toUTCString()}.
      </p>
      <p style="font-size: 12px; color: #6b7280; line-height: 1.5;">
        If you did not expect this email, you can safely ignore it.
      </p>
    </div>
  `

  const text = [
    `Welcome, ${input.firstName}`,
    '',
    input.mode === 'ADMIN_CREATE'
      ? `Your account at ${input.organizationName} is active. Set your password to get started.`
      : `You've been invited to ${input.organizationName}. Set your password to complete setup.`,
    '',
    `Set Password: ${input.setupLink}`,
    `Expires: ${expiresAt.toUTCString()}`,
  ].join('\n')

  return {
    from,
    to: input.to,
    subject,
    text,
    html,
  }
}

async function sendViaResend(input: WelcomeEmailInput): Promise<SendEmailResult> {
  const cfg = getResendConfig()
  if (!cfg) {
    return { sent: false, reason: 'RESEND_NOT_CONFIGURED' }
  }

  const email = buildWelcomeEmail(input, cfg.from)

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
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

async function sendViaSmtp(input: WelcomeEmailInput): Promise<SendEmailResult> {
  const cfg = getSmtpConfig()
  if (!cfg) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' }
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  })

  const email = buildWelcomeEmail(input, cfg.from)

  try {
    await transporter.sendMail(email)
    return { sent: true }
  } catch (error) {
    console.error('Failed to send welcome email via SMTP:', error)
    return { sent: false, reason: 'SMTP_SEND_FAILED' }
  }
}

export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<SendEmailResult> {
  const resendResult = await sendViaResend(input)
  if (resendResult.sent) {
    return resendResult
  }

  const smtpResult = await sendViaSmtp(input)
  if (smtpResult.sent) {
    return smtpResult
  }

  if (resendResult.reason === 'RESEND_SEND_FAILED') return resendResult
  if (smtpResult.reason === 'SMTP_SEND_FAILED') return smtpResult
  if (resendResult.reason === 'RESEND_NOT_CONFIGURED' && smtpResult.reason === 'SMTP_NOT_CONFIGURED') {
    return { sent: false, reason: 'NO_EMAIL_PROVIDER_CONFIGURED' }
  }

  return { sent: false, reason: smtpResult.reason || resendResult.reason || 'EMAIL_SEND_FAILED' }
}
