#!/usr/bin/env node
/**
 * Send a branded Lionheart test email via Resend.
 * Usage: node scripts/send-test-email.mjs <recipient> [template]
 *
 * Templates: welcome, password_setup, event_updated, event_approved,
 *            event_rejected, event_cancelled, event_invite
 */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const mjml2html = require('mjml')

const TO = process.argv[2] || 'lionheartops.app@gmail.com'
const TEMPLATE = process.argv[3] || 'welcome'
const API_KEY = process.env.RESEND_API_KEY || 're_jA1WA9h6_Cj5JJS2hfeMRWm8cGKmgt9i2'
const FROM = process.env.MAIL_FROM || 'Lionheart <no-reply@lionheartapp.com>'
const APP_URL = 'https://lionheart-ops.vercel.app'

// ─── Brand tokens ───────────────────────────────────────────────────

const B = {
  blue: '#1d4ed8',
  blueLight: '#eff6ff',
  dark: '#111827',
  gray100: '#f3f4f6',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray700: '#374151',
  green: '#059669',
  greenLight: '#ecfdf5',
  red: '#dc2626',
  redLight: '#fef2f2',
  white: '#ffffff',
}

// ─── Template data per type ─────────────────────────────────────────

const templates = {
  welcome: {
    subject: 'Welcome to Lionheart — your account is ready',
    subtitle: '- Your Account Is Ready -',
    headline: "It's Your Time<br />to Get Started",
    ctaLabel: 'Set Your Password',
    ctaUrl: `${APP_URL}/set-password?token=test`,
    body: `Your account at <strong>Linfield Christian School</strong> is ready. Explore your calendar, manage events, track inventory, and more — all in one place. What will you accomplish with Lionheart?`,
    bandCtaLabel: 'Set Your Password',
    bandCtaUrl: `${APP_URL}/set-password?token=test`,
  },
  password_setup: {
    subject: "You're invited to Lionheart",
    subtitle: "- You're Invited -",
    headline: 'Complete Your<br />Account Setup',
    ctaLabel: 'Set Your Password',
    ctaUrl: `${APP_URL}/set-password?token=test`,
    body: `You've been invited to join <strong>Linfield Christian School</strong> on Lionheart. Set your password to access calendars, events, facilities, and everything your team uses to stay organized.`,
    bandCtaLabel: 'Get Started',
    bandCtaUrl: `${APP_URL}/set-password?token=test`,
  },
  event_updated: {
    subject: 'Event rescheduled: Staff Meeting',
    subtitle: '- Event Update -',
    headline: 'Event<br />Rescheduled',
    ctaLabel: 'View Event',
    ctaUrl: `${APP_URL}/calendar?eventId=test`,
    detail: `<strong>Staff Meeting</strong> has been rescheduled by John Smith.`,
    detailCard: `<strong>New Time</strong><br />Friday, March 7, 2026<br />2:00 PM – 3:30 PM`,
    footnote: "You're receiving this because you're an attendee of this event.",
  },
  event_approved: {
    subject: 'Event approved: Spring Concert',
    subtitle: '- Good News -',
    headline: 'Event<br />Approved',
    ctaLabel: 'View Event',
    ctaUrl: `${APP_URL}/calendar?eventId=test`,
    ctaColor: B.green,
    detail: `Your event <strong>Spring Concert</strong> has been approved.`,
    detailCard: `Approved via <strong>facilities</strong> channel.`,
    detailBg: B.greenLight,
    detailBorder: B.green,
  },
  event_rejected: {
    subject: 'Event not approved: Field Day',
    subtitle: '- Event Update -',
    headline: 'Event Not<br />Approved',
    ctaLabel: 'View Event',
    ctaUrl: `${APP_URL}/calendar?eventId=test`,
    detail: `Your event <strong>Field Day</strong> was not approved.`,
    detailCard: `<strong>Reason</strong><br />The gymnasium is already reserved for that date. Please choose an alternative time.`,
    detailBg: B.redLight,
    detailBorder: B.red,
    extra: `You can edit your event and resubmit it for approval.`,
  },
  event_cancelled: {
    subject: 'Event cancelled: Faculty Lunch',
    subtitle: '- Event Update -',
    headline: 'Event<br />Cancelled',
    ctaLabel: null,
    detail: `The event <strong>Faculty Lunch</strong> has been cancelled and removed from the calendar.`,
    detailCard: `This event is no longer scheduled. No further action is needed.`,
    detailBg: B.gray100,
    detailBorder: B.gray500,
    footnote: "You're receiving this because you were an attendee of this event.",
  },
  event_invite: {
    subject: "You're invited: Parent-Teacher Night",
    subtitle: "- You're Invited -",
    headline: 'New Event<br />on Your Calendar',
    ctaLabel: 'View Event',
    ctaUrl: `${APP_URL}/calendar?eventId=test`,
    detail: `You've been added as an attendee to <strong>Parent-Teacher Night</strong>.`,
    detailCard: `<strong>When</strong><br />Thursday, March 13, 2026<br />6:00 PM – 8:00 PM`,
  },
}

const t = templates[TEMPLATE]
if (!t) {
  console.error(`Unknown template: ${TEMPLATE}. Options: ${Object.keys(templates).join(', ')}`)
  process.exit(1)
}

// ─── Build MJML ─────────────────────────────────────────────────────

const isWelcome = TEMPLATE === 'welcome' || TEMPLATE === 'password_setup'

// Hero section (welcome/invite style templates)
// For welcome/password_setup: only show heading, CTA is in blue band only
const heroContent = `
    <mj-section background-color="${B.white}" padding="40px 40px 0 40px">
      <mj-column>
        <mj-text align="center" font-size="13px" color="${B.blue}" padding-bottom="12px" letter-spacing="2px" css-class="subheading">
          ${t.subtitle}
        </mj-text>
        <mj-text align="center" font-size="36px" font-weight="700" color="${B.dark}" css-class="heading" line-height="1.15" padding-bottom="24px">
          ${t.headline}
        </mj-text>
      </mj-column>
    </mj-section>
    ${(!isWelcome && t.ctaLabel) ? `
    <mj-section background-color="${B.white}" padding="0 40px 8px 40px">
      <mj-column>
        <mj-button href="${t.ctaUrl}" background-color="${t.ctaColor || B.blue}" color="${B.white}" align="center" border-radius="24px" inner-padding="14px 40px">
          ${t.ctaLabel}
        </mj-button>
      </mj-column>
    </mj-section>` : ''}
`

// Detail section for event-type emails
const detailContent = t.detail ? `
    <mj-section background-color="${B.white}" padding="24px 40px">
      <mj-column>
        <mj-text align="center" padding-bottom="16px" font-size="16px">
          ${t.detail}
        </mj-text>
        ${t.detailCard ? `
        <mj-text padding="20px" background-color="${t.detailBg || B.blueLight}" border-radius="12px" border-left="4px solid ${t.detailBorder || B.blue}" font-size="14px" line-height="1.6">
          ${t.detailCard}
        </mj-text>` : ''}
        ${t.extra ? `<mj-text align="center" padding-top="16px" font-size="14px" color="${B.gray500}">${t.extra}</mj-text>` : ''}
      </mj-column>
    </mj-section>` : ''

// Footnote
const footnoteContent = t.footnote ? `
    <mj-section background-color="${B.white}" padding="8px 40px 24px 40px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="${B.gray400}">${t.footnote}</mj-text>
      </mj-column>
    </mj-section>` : ''

// Blue band (welcome emails only)
const blueBand = isWelcome ? `
    <mj-section background-color="${B.blue}" padding="48px 40px">
      <mj-column>
        <mj-text align="center" color="${B.white}" font-size="17px" line-height="1.6" padding-bottom="24px">
          ${t.body}
        </mj-text>
        ${t.bandCtaLabel ? `
        <mj-button href="${t.bandCtaUrl}" background-color="${B.white}" color="${B.blue}" align="center" border-radius="24px" inner-padding="12px 36px" font-size="15px" font-weight="600">
          ${t.bandCtaLabel}
        </mj-button>` : ''}
      </mj-column>
    </mj-section>` : ''

const mjmlSource = `<mjml>
  <mj-head>
    <mj-preview>${t.subject}</mj-preview>
    <mj-font name="Poppins" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" />
    <mj-font name="Oswald" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" />
      <mj-text font-size="15px" line-height="1.6" color="${B.gray700}" />
      <mj-button font-family="Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15px" font-weight="600" />
      <mj-section padding="0" />
      <mj-body background-color="${B.white}" width="600px" />
    </mj-attributes>
    <mj-style inline="inline">
      .heading { font-family: Oswald, 'Arial Narrow', Arial, sans-serif; font-weight: 700; letter-spacing: -0.01em; text-transform: uppercase; }
      .subheading { font-family: Poppins, sans-serif; font-weight: 400; letter-spacing: 0.1em; text-transform: uppercase; }
    </mj-style>
    <mj-style>
      .footer-link { color: ${B.gray400} !important; text-decoration: underline; font-size: 12px; }
      a { color: ${B.blue}; }
    </mj-style>
  </mj-head>
  <mj-body>

    <!-- Logo -->
    <mj-section background-color="${B.white}" padding="32px 40px 16px 40px">
      <mj-column>
        <mj-image src="${APP_URL}/email/logo-color.png" alt="Lionheart Educational Operations" width="280px" align="left" padding="0" />
      </mj-column>
    </mj-section>

    <!-- Blue divider -->
    <mj-section padding="0 40px">
      <mj-column>
        <mj-divider border-color="${B.blue}" border-width="2px" padding="0" />
      </mj-column>
    </mj-section>

    ${heroContent}
    ${detailContent}
    ${footnoteContent}
    ${blueBand}

    <!-- Footer -->
    <mj-section background-color="${B.white}" padding="32px 40px 16px 40px">
      <mj-column>
        <mj-text align="center" font-size="13px" color="${B.gray400}" line-height="1.6">
          Stay up to date with our latest news &amp; features.
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="${B.white}" padding="0 40px 32px 40px">
      <mj-column>
        <mj-text align="center" font-size="11px" color="${B.gray400}" line-height="1.5">
          &copy; 2026 Lionheart Educational Operations<br />
          <a href="${APP_URL}" class="footer-link">Open Lionheart</a>
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`

const { html, errors } = mjml2html(mjmlSource, { validationLevel: 'soft' })
if (errors.length > 0) {
  console.warn('MJML warnings:', errors.map(e => e.message))
}

console.log(`Sending "${TEMPLATE}" test email to ${TO}...`)

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: FROM,
    to: [TO],
    subject: t.subject,
    html,
    text: `${t.subtitle.replace(/-/g, '').trim()} — ${t.headline.replace(/<br\s*\/?>/g, ' ')}`,
  }),
})

const data = await res.json()
if (res.ok) {
  console.log('Sent!', data)
} else {
  console.error('Failed:', res.status, data)
}
