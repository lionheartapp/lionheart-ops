/**
 * Registration Magic Link Service
 *
 * Passwordless authentication for parent portals.
 * Magic links are SHA-256 hashed, single-use, expire in 48 hours.
 * Portal JWTs are short-lived (4hr) and typed differently from staff JWTs.
 */

import { createHash, randomBytes } from 'crypto'
import { SignJWT, jwtVerify } from 'jose'
import { rawPrisma } from '@/lib/db'
import { RateLimiter } from '@/lib/rate-limit'

// ─── Rate Limiters ────────────────────────────────────────────────────────────

/** 3 magic links per email per hour (prevent abuse) */
const emailRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 3,
})

/** 10 magic link requests per IP per hour (prevent enumeration) */
const ipRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 10,
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type RateLimitCheck = {
  allowed: boolean
  retryAfterSec?: number
}

export type PortalTokenClaims = {
  type: 'portal'
  registrationId: string
  organizationId: string
  email: string
}

// ─── Rate Limit Check ─────────────────────────────────────────────────────────

/**
 * Check both email and IP rate limiters before issuing a magic link.
 * Records the attempt if allowed.
 */
export function checkRateLimit(email: string, ip: string): RateLimitCheck {
  const emailKey = `email:${email.toLowerCase()}`
  const ipKey = `ip:${ip}`

  // Check email limiter
  const emailResult = emailRateLimiter.check(emailKey)
  if (!emailResult.allowed) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil(emailResult.retryAfterMs / 1000),
    }
  }

  // Check IP limiter
  const ipResult = ipRateLimiter.check(ipKey)
  if (!ipResult.allowed) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil(ipResult.retryAfterMs / 1000),
    }
  }

  // Both allowed — record the attempt
  emailRateLimiter.increment(emailKey)
  ipRateLimiter.increment(ipKey)

  return { allowed: true }
}

// ─── Issue Magic Link ─────────────────────────────────────────────────────────

/**
 * Creates a magic link row in the DB and sends it via email.
 * The raw token is never stored — only its SHA-256 hash.
 */
export async function issueMagicLink(
  email: string,
  registrationId: string,
  organizationId: string,
): Promise<{ success: true }> {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

  // Fetch registration details for email content
  const registration = await rawPrisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      eventProject: {
        select: { title: true, startsAt: true },
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

  // Store the hashed token
  await rawPrisma.registrationMagicLink.create({
    data: {
      organizationId,
      email: email.toLowerCase(),
      registrationId,
      tokenHash,
      expiresAt,
    },
  })

  // Build the portal link URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
  const orgSlug = registration?.form?.organization?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'portal'
  const portalLink = `${appUrl}/events/portal?token=${rawToken}`

  const eventTitle = registration?.eventProject?.title ?? 'Event Registration'
  const orgName = registration?.form?.organization?.name ?? 'Your School'
  const logoUrl = registration?.form?.organization?.logoUrl

  // Send the magic link email (fire-and-forget logging on failure)
  sendMagicLinkEmail({
    to: email,
    firstName: registration?.firstName,
    eventTitle,
    orgName,
    logoUrl,
    portalLink,
    expiresAt,
  }).catch((err) => {
    console.error('[registrationMagicLinkService] Failed to send magic link email:', err)
  })

  return { success: true }
}

// ─── Consume Magic Link ───────────────────────────────────────────────────────

/**
 * Validates and consumes a raw magic link token.
 * Returns a short-lived portal JWT on success.
 * Throws if the token is invalid, expired, or already used.
 */
export async function consumeMagicLink(rawToken: string): Promise<{
  portalToken: string
  registrationId: string
}> {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')

  const link = await rawPrisma.registrationMagicLink.findUnique({
    where: { tokenHash },
  })

  if (!link) {
    throw new Error('INVALID_TOKEN')
  }

  if (link.usedAt !== null) {
    throw new Error('TOKEN_ALREADY_USED')
  }

  if (link.expiresAt < new Date()) {
    throw new Error('TOKEN_EXPIRED')
  }

  // Mark token as used (single-use enforcement)
  await rawPrisma.registrationMagicLink.update({
    where: { id: link.id },
    data: { usedAt: new Date() },
  })

  // Sign a portal JWT — separate from staff JWTs, with 'portal' type claim
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-secret-change-me')
  const portalToken = await new SignJWT({
    type: 'portal',
    registrationId: link.registrationId,
    organizationId: link.organizationId,
    email: link.email,
  } satisfies PortalTokenClaims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(secret)

  return { portalToken, registrationId: link.registrationId }
}

// ─── Verify Portal Token ──────────────────────────────────────────────────────

/**
 * Verifies a portal JWT and returns its claims.
 * CRITICAL: This is NOT a staff token. Do NOT call assertCan() on portal routes.
 * The 'portal' type claim explicitly distinguishes it from staff tokens.
 */
export async function verifyPortalToken(token: string): Promise<PortalTokenClaims> {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? 'dev-secret-change-me')

  const { payload } = await jwtVerify(token, secret)

  if (payload.type !== 'portal') {
    throw new Error('INVALID_TOKEN_TYPE')
  }

  if (!payload.registrationId || !payload.organizationId || !payload.email) {
    throw new Error('INVALID_TOKEN_CLAIMS')
  }

  return {
    type: 'portal',
    registrationId: String(payload.registrationId),
    organizationId: String(payload.organizationId),
    email: String(payload.email),
  }
}

// ─── Magic Link Email ─────────────────────────────────────────────────────────

type MagicLinkEmailInput = {
  to: string
  firstName?: string | null
  eventTitle: string
  orgName: string
  logoUrl?: string | null
  portalLink: string
  expiresAt: Date
}

async function sendMagicLinkEmail(input: MagicLinkEmailInput): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.MAIL_FROM?.trim() || `${input.orgName} <no-reply@lionheartapp.com>`
  const subject = `Your registration portal link — ${input.eventTitle}`

  const expiresStr = input.expiresAt.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const greeting = input.firstName ? `Hi ${input.firstName},` : 'Hi there,'

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
      ${input.logoUrl ? `<img src="${input.logoUrl}" alt="${input.orgName}" style="height: 40px; margin-bottom: 16px; display: block;">` : ''}
      <p style="color: #bfdbfe; margin: 0 0 4px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em;">${input.orgName}</p>
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Your Portal Link</h1>
      <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 14px;">${input.eventTitle}</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="color: #374151; margin: 0 0 8px; font-size: 15px;">${greeting}</p>
      <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.6;">
        Click the button below to access your registration portal for <strong>${input.eventTitle}</strong>.
        This link is valid for 48 hours and can only be used once.
      </p>

      <a href="${input.portalLink}"
         style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; margin-bottom: 24px;">
        View My Registration
      </a>

      <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="color: #9ca3af; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 6px;">Link expires</p>
        <p style="color: #374151; font-size: 13px; margin: 0;">${expiresStr}</p>
      </div>

      <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        If you did not request this link, you can safely ignore this email.
        This link grants access to your registration only — no Lionheart account is required.
        Sent by ${input.orgName} via Lionheart.
      </p>
    </div>
  </div>
</body>
</html>`

  const text = `Your registration portal link

${greeting}

Click this link to view your registration for ${input.eventTitle}:
${input.portalLink}

This link expires: ${expiresStr}

If you did not request this link, you can safely ignore this email.
Sent by ${input.orgName} via Lionheart.`

  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [input.to], subject, html, text }),
      })
      if (res.ok) return
      const body = await res.text()
      console.error('[registrationMagicLinkService] Resend failed:', res.status, body)
    } catch (err) {
      console.error('[registrationMagicLinkService] Resend error:', err)
    }
  }

  // SMTP fallback
  const smtpHost = process.env.SMTP_HOST?.trim()
  const smtpUser = process.env.SMTP_USER?.trim()
  const smtpPass = process.env.SMTP_PASS?.trim()
  const smtpPortRaw = process.env.SMTP_PORT?.trim()

  if (smtpHost && smtpUser && smtpPass && smtpPortRaw) {
    const port = Number(smtpPortRaw)
    const secure = process.env.SMTP_SECURE === 'true' || port === 465
    try {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: { user: smtpUser, pass: smtpPass },
      })
      await transporter.sendMail({ from, to: input.to, subject, html, text })
    } catch (err) {
      console.error('[registrationMagicLinkService] SMTP error:', err)
    }
  }
}
