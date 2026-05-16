#!/usr/bin/env node
/**
 * Send a branded Lionheart test email via Resend.
 * Usage: node scripts/send-test-email.mjs <recipient> [template]
 *
 * Design: matches lionheartapp.com — near-black on warm white, Inter,
 * monochrome restraint with subtle hairlines.
 *
 * Templates: welcome, password_setup, password_reset, email_verification,
 *            event_invite, event_updated, event_approved, event_rejected,
 *            event_cancelled, maintenance_submitted, maintenance_assigned,
 *            maintenance_urgent, maintenance_done, it_ticket_submitted,
 *            it_ticket_urgent, it_ticket_done
 */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const mjml2html = require('mjml')

const TO = process.argv[2] || 'lionheartops.app@gmail.com'
const TEMPLATE = process.argv[3] || 'welcome'
const API_KEY = process.env.RESEND_API_KEY || 're_jA1WA9h6_Cj5JJS2hfeMRWm8cGKmgt9i2'
const FROM = process.env.MAIL_FROM || 'Lionheart <no-reply@lionheartapp.com>'
const APP_URL = 'https://lionheart-ops.vercel.app'

// ─── Brand tokens (lionheartapp.com style) ──────────────────────────

const B = {
  nearBlack: '#0f0f0f',
  textSec: '#5a5a5a',
  textMute: '#9a9a9a',
  border: '#e7e7e6',
  borderSoft: '#efefee',
  surface: '#ffffff',
  surfaceAlt: '#fafaf9',
  surfaceWarm: '#fdfcfb',
  green: '#047857',
  greenLight: '#ecfdf5',
  greenBorder: '#bbf7d0',
  red: '#b91c1c',
  redLight: '#fef2f2',
  redBorder: '#fecaca',
  amber: '#b45309',
  amberLight: '#fffbeb',
  amberBorder: '#fde68a',
  gray50: '#f7f7f6',
  white: '#ffffff',
}

const FONT_STACK = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
const YEAR = new Date().getFullYear()

// ─── Helpers (mirror src/lib/email/email-layout.ts) ─────────────────

function pill(label, variant = 'gray') {
  const p = {
    green: { bg: B.greenLight, fg: B.green },
    red: { bg: B.redLight, fg: B.red },
    amber: { bg: B.amberLight, fg: B.amber },
    gray: { bg: B.gray50, fg: B.textSec },
  }[variant]
  return `<span style="display:inline-block;background:${p.bg};color:${p.fg};padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;">${label}</span>`
}

function ticketTag(id) {
  return `<span style="display:inline-block;font-family:'SF Mono',Menlo,monospace;font-size:12px;font-weight:600;color:${B.nearBlack};background:${B.surface};border:1px solid ${B.border};padding:2px 8px;border-radius:5px;">${id}</span>`
}

function kvRows(rows) {
  return rows
    .map(
      ([k, v], i) =>
        `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;${i === 0 ? '' : `border-top:1px solid ${B.borderSoft};`}"><tr><td style="padding:8px 0;color:${B.textSec};font-size:13.5px;font-weight:500;">${k}</td><td align="right" style="padding:8px 0;color:${B.nearBlack};font-size:14px;font-weight:600;">${v}</td></tr></table>`
    )
    .join('')
}

function hero(eyebrow, headline) {
  return `
    <mj-section background-color="${B.surface}" padding="36px 32px 0 32px">
      <mj-column>
        <mj-text align="left" font-size="12px" color="${B.textSec}" padding="0 0 10px 0" css-class="subheading">${eyebrow}</mj-text>
        <mj-text align="left" font-size="30px" font-weight="700" color="${B.nearBlack}" css-class="heading" line-height="1.18" padding="0 0 14px 0">${headline}</mj-text>
      </mj-column>
    </mj-section>`
}

function lede(html) {
  return `
    <mj-section background-color="${B.surface}" padding="0 32px 6px 32px">
      <mj-column>
        <mj-text padding="0" align="left" font-size="16px" line-height="1.55" color="${B.textSec}">${html}</mj-text>
      </mj-column>
    </mj-section>`
}

function cta(label, url, color = B.nearBlack) {
  return `
    <mj-section background-color="${B.surface}" padding="6px 32px 12px 32px">
      <mj-column>
        <mj-button href="${url}" background-color="${color}" color="${B.white}" align="left" border-radius="8px" inner-padding="12px 22px" font-size="14.5px" font-weight="600">${label}</mj-button>
      </mj-column>
    </mj-section>`
}

function detailCard(content, bg = B.surfaceAlt, border = B.border) {
  return `
    <mj-section background-color="${B.surface}" padding="12px 32px 16px 32px">
      <mj-column>
        <mj-text padding="0" align="left">
          <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:14px 18px;font-family:${FONT_STACK};">
            ${content}
          </div>
        </mj-text>
      </mj-column>
    </mj-section>`
}

function micro(html) {
  return `
    <mj-section background-color="${B.surface}" padding="6px 32px 16px 32px">
      <mj-column>
        <mj-text padding="0" align="left" font-size="13px" line-height="1.5" color="${B.textMute}">${html}</mj-text>
      </mj-column>
    </mj-section>`
}

function band(text, ctaLabel, ctaUrl) {
  return `
    <mj-section background-color="${B.nearBlack}" padding="40px 32px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="16px" line-height="1.55" padding-bottom="${ctaLabel ? '20px' : '0'}">${text}</mj-text>
        ${ctaLabel ? `<mj-button href="${ctaUrl}" background-color="#ffffff" color="${B.nearBlack}" align="center" border-radius="8px" inner-padding="12px 22px" font-size="14px" font-weight="600">${ctaLabel}</mj-button>` : ''}
      </mj-column>
    </mj-section>`
}

// ─── Template data ──────────────────────────────────────────────────

const templates = {
  welcome: {
    subject: 'Welcome to Lionheart',
    body: () => [
      hero('Account ready', 'Welcome to Lionheart,<br/>Sarah.'),
      lede(`Your administrator at <strong style="color:${B.nearBlack};">Linfield Christian School</strong> set up an account for you. Set a password and you're in — calendars, events, work orders, and inventory, all in one place.`),
      cta('Set your password', `${APP_URL}/set-password?token=test`),
      micro(`This link expires Friday, May 15, 2026 at 4:30 PM. Need a new one? Ask your admin to resend.`),
      band(`<strong style="color:#ffffff;">Lionheart</strong> is the single workspace for schools that run on details — events, facilities, IT, athletics, and the people behind it all.`, "See what's inside", APP_URL),
    ].join(''),
  },
  password_setup: {
    subject: "You're invited to Lionheart",
    body: () => [
      hero("You're invited", 'Join your team<br/>on Lionheart.'),
      lede(`<strong style="color:${B.nearBlack};">Linfield Christian School</strong> invited you to their workspace. Set a password to access the calendar, submit requests, and stay in the loop.`),
      cta('Get started', `${APP_URL}/set-password?token=test`),
      micro(`Invite expires Friday, May 15 at 4:30 PM. If you weren't expecting this, you can ignore it.`),
    ].join(''),
  },
  password_reset: {
    subject: 'Reset your password',
    body: () => [
      hero('Password reset', 'Reset your password.'),
      lede(`Hi Sarah — we got a request to reset your Lionheart password for <strong style="color:${B.nearBlack};">Linfield Christian School</strong>. The link is good for one hour.`),
      cta('Reset password', `${APP_URL}/reset-password?token=test`),
      micro(`Didn't request this? You can ignore this email. Your password won't change.`),
    ].join(''),
  },
  email_verification: {
    subject: 'Verify your email address',
    body: () => [
      hero('One last step', 'Verify your email.'),
      lede(`Welcome to <strong style="color:${B.nearBlack};">Lionheart</strong>. Click below to confirm this is your address and activate your account.`),
      cta('Verify email', `${APP_URL}/verify?token=test`),
      micro(`This link expires in 24 hours. Didn't sign up? Just ignore this email.`),
    ].join(''),
  },
  event_invite: {
    subject: "You're invited: Spring Awards Ceremony",
    body: () => [
      hero("You're invited", 'New event<br/>on your calendar.'),
      lede(`You've been added as an attendee to <strong style="color:${B.nearBlack};">Spring Awards Ceremony</strong>.`),
      detailCard(kvRows([
        ['When', 'Fri, May 22 · 6:00 PM'],
        ['Where', 'Linfield Gymnasium'],
      ])),
      cta('View event', `${APP_URL}/calendar?eventId=test`),
    ].join(''),
  },
  event_updated: {
    subject: 'Event rescheduled: Spring Awards Ceremony',
    body: () => [
      hero('Event update', 'Spring Awards<br/>has moved.'),
      lede(`<strong style="color:${B.nearBlack};">Spring Awards Ceremony</strong> was rescheduled by Marcus Thompson.`),
      detailCard(kvRows([
        ['Was', 'Fri, May 22 · 6:00 PM'],
        ['Now', 'Sat, May 23 · 5:00 PM'],
        ['Location', 'Linfield Gymnasium'],
      ])),
      cta('View event', `${APP_URL}/calendar?eventId=test`),
      micro(`You're getting this because you're an attendee. RSVPs roll over — no need to respond again.`),
    ].join(''),
  },
  event_approved: {
    subject: 'Event approved: Robotics Demo Night',
    body: () => [
      hero('Approved', 'Your event got<br/>the green light.'),
      lede(`<strong style="color:${B.nearBlack};">Robotics Demo Night</strong> was approved and is now on the master calendar.`),
      detailCard(kvRows([
        ['Approved by', 'Facilities channel'],
        ['When', 'Tue, May 19 · 7:00 PM'],
        ['Status', pill('Live on calendar', 'green')],
      ]), B.greenLight, B.greenBorder),
      cta('View event', `${APP_URL}/calendar?eventId=test`, B.green),
    ].join(''),
  },
  event_rejected: {
    subject: 'Event not approved: Field Day',
    body: () => [
      hero('Event update', 'Event not approved.'),
      lede(`Your event <strong style="color:${B.nearBlack};">Field Day</strong> wasn't approved this round.`),
      detailCard(kvRows([
        ['Channel', 'Facilities'],
        ['Reason', 'Gymnasium already reserved'],
      ]), B.redLight, B.redBorder),
      micro(`You can edit the event (date, location, etc.) and resubmit any time.`),
      cta('Edit and resubmit', `${APP_URL}/calendar?eventId=test`),
    ].join(''),
  },
  event_cancelled: {
    subject: 'Event cancelled: Faculty Lunch',
    body: () => [
      hero('Event update', 'Faculty Lunch<br/>was cancelled.'),
      lede(`The event was removed from the calendar by the organizer.`),
      detailCard(kvRows([['Status', pill('Cancelled', 'gray')]]), B.gray50, B.border),
      micro(`No action needed. You're receiving this because you were on the attendee list.`),
    ].join(''),
  },
  maintenance_submitted: {
    subject: 'Maintenance request MT-1042 received',
    body: () => [
      hero('Maintenance', 'We got your request.'),
      lede(`Your request is in the queue. We'll keep you posted as it moves.`),
      detailCard(kvRows([
        ['Ticket', ticketTag('MT-1042')],
        ['Title', 'Broken light fixture, Room 214'],
        ['Priority', pill('Medium', 'amber')],
      ])),
      cta('Track your request', `${APP_URL}/maintenance/tickets/MT-1042`),
    ].join(''),
  },
  maintenance_assigned: {
    subject: 'Work order assigned: MT-1042',
    body: () => [
      hero('Work order', 'New ticket on your queue.'),
      lede(`This one is yours. Tap through for full context — photos, history, and location.`),
      detailCard(kvRows([
        ['Ticket', ticketTag('MT-1042')],
        ['Title', 'Broken light fixture, Room 214'],
        ['Priority', pill('High', 'red')],
        ['Category', 'Electrical'],
        ['Location', 'Main Building, Floor 2'],
      ])),
      cta('View ticket', `${APP_URL}/maintenance/tickets/MT-1042`),
    ].join(''),
  },
  maintenance_urgent: {
    subject: 'URGENT maintenance request: MT-1043',
    body: () => [
      hero('Urgent', 'Immediate attention needed.'),
      lede(`An <strong style="color:${B.nearBlack};">urgent</strong> maintenance request was just submitted. Please review and assign.`),
      detailCard(kvRows([
        ['Ticket', ticketTag('MT-1043')],
        ['Title', 'Water leak from ceiling, Cafeteria'],
        ['Category', 'Plumbing'],
        ['Location', 'Cafeteria, Main Building'],
        ['Priority', pill('Urgent', 'red')],
      ]), B.redLight, B.redBorder),
      cta('View urgent ticket', `${APP_URL}/maintenance/tickets/MT-1043`, B.red),
    ].join(''),
  },
  maintenance_done: {
    subject: 'Request MT-1042 completed',
    body: () => [
      hero('All done', 'Request completed.'),
      lede(`Your maintenance request has been resolved and closed.`),
      detailCard(kvRows([
        ['Ticket', ticketTag('MT-1042')],
        ['Title', 'Broken light fixture, Room 214'],
        ['Status', pill('Completed', 'green')],
      ]), B.greenLight, B.greenBorder),
      cta('View details', `${APP_URL}/maintenance/tickets/MT-1042`, B.green),
      micro(`Thanks for using Lionheart maintenance.`),
    ].join(''),
  },
  it_ticket_submitted: {
    subject: 'IT request IT-2087 received',
    body: () => [
      hero('IT help desk', 'We got your request.'),
      lede(`Your IT request is in the queue. We'll keep you updated as it moves.`),
      detailCard(kvRows([
        ['Ticket', ticketTag('IT-2087')],
        ['Title', 'Laptop not connecting to WiFi'],
        ['Category', 'Network'],
      ])),
      cta('Track your request', `${APP_URL}/it/tickets/IT-2087`),
    ].join(''),
  },
  it_ticket_urgent: {
    subject: 'URGENT IT request: IT-2090',
    body: () => [
      hero('Urgent', 'IT request —<br/>immediate attention needed.'),
      lede(`An <strong style="color:${B.nearBlack};">urgent</strong> IT request was just submitted.`),
      detailCard(kvRows([
        ['Ticket', ticketTag('IT-2090')],
        ['Title', 'Network outage — main building'],
        ['Category', 'Infrastructure'],
        ['Priority', pill('Urgent', 'red')],
      ]), B.redLight, B.redBorder),
      cta('View urgent ticket', `${APP_URL}/it/tickets/IT-2090`, B.red),
    ].join(''),
  },
  it_ticket_done: {
    subject: 'IT request IT-2087 resolved',
    body: () => [
      hero('All done', 'IT request resolved.'),
      lede(`Your IT request is closed.`),
      detailCard(kvRows([
        ['Ticket', ticketTag('IT-2087')],
        ['Title', 'Laptop not connecting to WiFi'],
        ['Status', pill('Resolved', 'green')],
      ]), B.greenLight, B.greenBorder),
      cta('View details', `${APP_URL}/it/tickets/IT-2087`, B.green),
      micro(`Thanks for using the IT help desk.`),
    ].join(''),
  },
}

const t = templates[TEMPLATE]
if (!t) {
  console.error(`Unknown template: ${TEMPLATE}\n\nOptions:\n  ${Object.keys(templates).join('\n  ')}`)
  process.exit(1)
}

// ─── Build MJML ─────────────────────────────────────────────────────

const mjmlSource = `<mjml>
  <mj-head>
    <mj-preview>${t.subject}</mj-preview>
    <mj-raw>
      <meta name="color-scheme" content="light only" />
      <meta name="supported-color-schemes" content="light only" />
    </mj-raw>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
    <mj-attributes>
      <mj-all font-family="${FONT_STACK}" />
      <mj-text font-size="15px" line-height="1.6" color="${B.nearBlack}" />
      <mj-button font-family="${FONT_STACK}" font-size="14.5px" font-weight="600" />
      <mj-section padding="0" />
      <mj-body background-color="${B.surfaceWarm}" width="600px" />
    </mj-attributes>
    <mj-style inline="inline">
      .heading { font-family: ${FONT_STACK}; font-weight: 700; letter-spacing: -0.022em; }
      .subheading { font-family: ${FONT_STACK}; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
    </mj-style>
    <mj-style>
      :root { color-scheme: light only; }
      .footer-link { color: ${B.textSec} !important; text-decoration: none; font-size: 12px; font-weight: 500; }
      a { color: ${B.nearBlack}; }
    </mj-style>
  </mj-head>
  <mj-body background-color="${B.surfaceWarm}">

    <!-- Logo bar -->
    <mj-section background-color="${B.surface}" padding="24px 32px 16px 32px">
      <mj-column width="44px" vertical-align="middle">
        <mj-text padding="0" align="left">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td bgcolor="${B.nearBlack}" width="34" height="34" align="center" valign="middle" style="background:${B.nearBlack};border-radius:8px;color:#ffffff;font-family:${FONT_STACK};font-size:16px;font-weight:800;line-height:34px;letter-spacing:-0.02em;">
              <a href="${APP_URL}" style="color:#ffffff;text-decoration:none;display:block;width:34px;height:34px;line-height:34px;">L</a>
            </td>
          </tr></table>
        </mj-text>
      </mj-column>
      <mj-column vertical-align="middle">
        <mj-text padding="0 0 0 12px" font-size="16px" font-weight="700" color="${B.nearBlack}" line-height="34px">Lionheart</mj-text>
      </mj-column>
    </mj-section>

    <!-- Hairline -->
    <mj-section background-color="${B.surface}" padding="0 32px">
      <mj-column>
        <mj-divider border-color="${B.border}" border-width="1px" padding="0" />
      </mj-column>
    </mj-section>

    ${t.body()}

    <!-- Footer -->
    <mj-section background-color="${B.surfaceWarm}" padding="28px 32px 8px 32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="${B.textSec}" line-height="1.6">
          <a href="${APP_URL}" class="footer-link">Open app</a>
          &nbsp;·&nbsp;
          <a href="${APP_URL}/settings/notifications" class="footer-link">Notification settings</a>
          &nbsp;·&nbsp;
          <a href="${APP_URL}/help" class="footer-link">Help center</a>
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="${B.surfaceWarm}" padding="0 32px 28px 32px">
      <mj-column>
        <mj-text align="center" font-size="11px" color="${B.textMute}" line-height="1.5">
          &copy; ${YEAR} Lionheart Educational Operations · lionheartapp.com<br />
          Made for schools, districts, and teams that run on details.
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
    text: t.subject,
  }),
})

const data = await res.json()
if (res.ok) {
  console.log('Sent!', data)
} else {
  console.error('Failed:', res.status, data)
}
