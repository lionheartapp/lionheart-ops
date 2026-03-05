/**
 * Lionheart-branded MJML email templates.
 *
 * Design: Wix-style clean layout with Lionheart as the sender brand.
 * Logo → divider → hero content → optional blue band → footer.
 * Brand: Primary blue #1d4ed8, headings Oswald, body Poppins.
 */

import mjml2html from 'mjml'

// ─── Brand Tokens ────────────────────────────────────────────────────────────

const B = {
  blue: '#1d4ed8',
  blueDark: '#1e3a8a',
  blueLight: '#eff6ff',
  dark: '#111827',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',
  green: '#059669',
  greenLight: '#ecfdf5',
  red: '#dc2626',
  redLight: '#fef2f2',
  white: '#ffffff',
}

// Hosted logo — PNG for email client compatibility (Gmail doesn't support SVG)
const LOGO_URL = '{{appUrl}}/email/logo-color.png'

// ─── Shared Layout ──────────────────────────────────────────────────────────

/**
 * Full Wix-style layout: logo header, content, optional blue band, footer.
 */
function wrapLayout(opts: {
  previewText: string
  content: string
  /** Optional blue band section below main content */
  blueBand?: { text: string; ctaLabel?: string; ctaUrl?: string }
}): string {
  const blueBandMjml = opts.blueBand
    ? `
    <!-- Blue band section -->
    <mj-section background-color="${B.blue}" padding="48px 40px">
      <mj-column>
        <mj-text align="center" color="${B.white}" font-size="17px" line-height="1.6" padding-bottom="${opts.blueBand.ctaLabel ? '24px' : '0'}">
          ${opts.blueBand.text}
        </mj-text>
        ${opts.blueBand.ctaLabel
          ? `<mj-button href="${opts.blueBand.ctaUrl || '{{appUrl}}'}" background-color="${B.white}" color="${B.blue}" align="center" border-radius="24px" inner-padding="12px 36px" font-size="15px" font-weight="600">
              ${opts.blueBand.ctaLabel}
            </mj-button>`
          : ''}
      </mj-column>
    </mj-section>`
    : ''

  return `
<mjml>
  <mj-head>
    <mj-preview>${opts.previewText}</mj-preview>
    <mj-raw>
      <meta name="color-scheme" content="light only" />
      <meta name="supported-color-schemes" content="light only" />
    </mj-raw>
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
      :root { color-scheme: light only; }
      .footer-link { color: ${B.gray400} !important; text-decoration: underline; font-size: 12px; }
      a { color: ${B.blue}; }
      /* Force light mode in all email clients */
      [data-ogsc] body, [data-ogsb] body { background-color: ${B.white} !important; color: ${B.gray700} !important; }
      @media (prefers-color-scheme: dark) {
        body, .body { background-color: ${B.white} !important; }
        h1, h2, h3, p, td, th, div, span { color: inherit !important; }
        .dark-img { display: none !important; }
        .light-img { display: block !important; }
      }
    </mj-style>
  </mj-head>
  <mj-body>

    <!-- Logo header -->
    <mj-section background-color="${B.white}" padding="32px 40px 16px 40px">
      <mj-column>
        <mj-image src="${LOGO_URL}" alt="Lionheart Educational Operations" width="180px" align="center" padding="0" />
      </mj-column>
    </mj-section>

    <!-- Divider under logo -->
    <mj-section padding="0 40px">
      <mj-column>
        <mj-divider border-color="${B.blue}" border-width="2px" padding="0" />
      </mj-column>
    </mj-section>

    <!-- Main content -->
    ${opts.content}

    ${blueBandMjml}

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
          &copy; {{currentYear}} Lionheart Educational Operations<br />
          <a href="{{appUrl}}" class="footer-link">Open Lionheart</a>
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function heroHeading(subtitle: string, headline: string): string {
  return `
    <mj-section background-color="${B.white}" padding="40px 40px 0 40px">
      <mj-column>
        <mj-text align="center" font-size="13px" color="${B.blue}" css-class="subheading" padding-bottom="12px" letter-spacing="2px">
          ${subtitle}
        </mj-text>
        <mj-text align="center" font-size="36px" font-weight="700" color="${B.dark}" css-class="heading" line-height="1.15" padding-bottom="24px">
          ${headline}
        </mj-text>
      </mj-column>
    </mj-section>`
}

function centeredCta(label: string, url: string, color = B.blue): string {
  return `
    <mj-section background-color="${B.white}" padding="0 40px 8px 40px">
      <mj-column>
        <mj-button href="${url}" background-color="${color}" color="${B.white}" align="center" border-radius="24px" inner-padding="14px 40px">
          ${label}
        </mj-button>
      </mj-column>
    </mj-section>`
}

function contentSection(html: string, padding = '24px 40px'): string {
  return `
    <mj-section background-color="${B.white}" padding="${padding}">
      <mj-column>
        ${html}
      </mj-column>
    </mj-section>`
}

/**
 * Email-safe info card using inline HTML div inside mj-text.
 * Supports border-radius, border, and hugs content width.
 * Works in Gmail, Apple Mail, Outlook (web/Mac).
 */
function detailCard(content: string, bgColor = B.blueLight, accentColor = B.blue): string {
  // Derive a slightly darker border from the accent color (20% opacity over white)
  const borderColor = accentColor
  return `
    <mj-section background-color="${B.white}" padding="16px 40px 8px 40px">
      <mj-column>
        <mj-text padding="0" align="center">
          <div style="background-color: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 20px 24px; text-align: center; display: inline-block; width: auto; max-width: 100%;">
            <span style="font-size: 15px; line-height: 1.7; color: ${B.dark};">${content}</span>
          </div>
        </mj-text>
      </mj-column>
    </mj-section>`
}

function heroImage(src: string, alt: string): string {
  return `
    <mj-section background-color="${B.white}" padding="16px 0 0 0">
      <mj-column>
        <mj-image src="${src}" alt="${alt}" width="600px" padding="0" />
      </mj-column>
    </mj-section>`
}

// ─── Template Definitions ────────────────────────────────────────────────────

export type EmailTemplate =
  | 'welcome'
  | 'event_updated'
  | 'event_approved'
  | 'event_rejected'
  | 'event_cancelled'
  | 'event_invite'
  | 'password_setup'

type TemplateVars = Record<string, string | undefined>

function getTemplateMjml(template: EmailTemplate, vars: TemplateVars): string {
  switch (template) {
    // ── Welcome (new account created by admin) ──
    case 'welcome':
      return wrapLayout({
        previewText: 'Your account is ready — set your password to get started',
        content: [
          heroHeading('- Your Account Is Ready -', "It's Your Time<br />to Get Started"),
        ].join('\n'),
        blueBand: {
          text: `Your account at <strong>{{orgName}}</strong> is ready. Explore your calendar, manage events, track inventory, and more — all in one place. What will you accomplish with Lionheart?`,
          ctaLabel: 'Set Your Password',
          ctaUrl: '{{setupLink}}',
        },
      })

    // ── Password setup (invited user) ──
    case 'password_setup':
      return wrapLayout({
        previewText: 'Set your password to join {{orgName}} on Lionheart',
        content: [
          heroHeading("- You're Invited -", 'Complete Your<br />Account Setup'),
        ].join('\n'),
        blueBand: {
          text: `You've been invited to join <strong>{{orgName}}</strong> on Lionheart. Set your password to access calendars, events, facilities, and everything your team uses to stay organized.`,
          ctaLabel: 'Get Started',
          ctaUrl: '{{setupLink}}',
        },
      })

    // ── Event rescheduled ──
    case 'event_updated':
      return wrapLayout({
        previewText: '{{eventTitle}} has been rescheduled',
        content: [
          heroHeading('- Event Update -', 'Event<br />Rescheduled'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              <strong>{{eventTitle}}</strong> has been rescheduled by {{updatedByName}}.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `<strong>New Time</strong><br />{{eventDate}}<br />{{eventTime}}`
          ),
          centeredCta('View Event', '{{eventLink}}'),
          contentSection(
            `<mj-text align="center" font-size="12px" color="${B.gray400}">You're receiving this because you're an attendee of this event.</mj-text>`,
            '8px 40px 24px 40px'
          ),
        ].join('\n'),
      })

    // ── Event approved ──
    case 'event_approved':
      return wrapLayout({
        previewText: 'Your event "{{eventTitle}}" has been approved',
        content: [
          heroHeading('- Good News -', 'Event<br />Approved'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your event <strong>{{eventTitle}}</strong> has been approved.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            `Approved via <strong>{{channelName}}</strong> channel.`,
            B.greenLight,
            B.green
          ),
          centeredCta('View Event', '{{eventLink}}', B.green),
        ].join('\n'),
      })

    // ── Event rejected ──
    case 'event_rejected':
      return wrapLayout({
        previewText: 'Your event "{{eventTitle}}" was not approved',
        content: [
          heroHeading('- Event Update -', 'Event Not<br />Approved'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              Your event <strong>{{eventTitle}}</strong> was not approved.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          vars.reason
            ? detailCard(`<strong>Reason</strong><br />{{reason}}`, B.redLight, B.red)
            : '',
          contentSection(
            `<mj-text align="center" padding-bottom="0" font-size="14px" color="${B.gray500}">
              You can edit your event and resubmit it for approval.
            </mj-text>`,
            '8px 40px 16px 40px'
          ),
          centeredCta('View Event', '{{eventLink}}'),
        ].filter(Boolean).join('\n'),
      })

    // ── Event cancelled ──
    case 'event_cancelled':
      return wrapLayout({
        previewText: '{{eventTitle}} has been cancelled',
        content: [
          heroHeading('- Event Update -', 'Event<br />Cancelled'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              The event <strong>{{eventTitle}}</strong> has been cancelled and removed from the calendar.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          detailCard(
            'This event is no longer scheduled. No further action is needed.',
            B.gray100,
            B.gray500
          ),
          contentSection(
            `<mj-text align="center" font-size="12px" color="${B.gray400}">You're receiving this because you were an attendee of this event.</mj-text>`,
            '8px 40px 24px 40px'
          ),
        ].join('\n'),
      })

    // ── Event invite ──
    case 'event_invite':
      return wrapLayout({
        previewText: 'You\'ve been added to "{{eventTitle}}"',
        content: [
          heroHeading("- You're Invited -", 'New Event<br />on Your Calendar'),
          contentSection(
            `<mj-text align="center" padding="0" font-size="16px">
              You've been added as an attendee to <strong>{{eventTitle}}</strong>.
            </mj-text>`,
            '8px 40px 0 40px'
          ),
          vars.eventDate
            ? detailCard(`<strong>When</strong><br />{{eventDate}}<br />{{eventTime}}`)
            : '',
          centeredCta('View Event', '{{eventLink}}'),
        ].filter(Boolean).join('\n'),
      })

    default:
      throw new Error(`Unknown email template: ${template}`)
  }
}

// ─── Compile & Render ────────────────────────────────────────────────────────

function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

export interface RenderEmailResult {
  html: string
  subject: string
  text: string
}

const SUBJECTS: Record<EmailTemplate, string> = {
  welcome: 'Welcome to Lionheart',
  password_setup: "You're invited to Lionheart",
  event_updated: 'Event rescheduled: {{eventTitle}}',
  event_approved: 'Event approved: {{eventTitle}}',
  event_rejected: 'Event not approved: {{eventTitle}}',
  event_cancelled: 'Event cancelled: {{eventTitle}}',
  event_invite: "You're invited: {{eventTitle}}",
}

const TEXT_BODIES: Record<EmailTemplate, string> = {
  welcome: 'Welcome to Lionheart! Your account at {{orgName}} is ready. Set your password: {{setupLink}}',
  password_setup: "You've been invited to join {{orgName}} on Lionheart. Set your password: {{setupLink}}",
  event_updated: '"{{eventTitle}}" was rescheduled by {{updatedByName}}. New time: {{eventDate}}, {{eventTime}}. View: {{eventLink}}',
  event_approved: 'Your event "{{eventTitle}}" was approved via {{channelName}} channel. View: {{eventLink}}',
  event_rejected: 'Your event "{{eventTitle}}" was not approved. {{reason}} View: {{eventLink}}',
  event_cancelled: '"{{eventTitle}}" has been cancelled and removed from the calendar.',
  event_invite: 'You\'ve been added to "{{eventTitle}}". View: {{eventLink}}',
}

/**
 * Render a Lionheart-branded email template.
 */
export function renderEmail(template: EmailTemplate, vars: TemplateVars): RenderEmailResult {
  // Inject current year for footer copyright
  const enrichedVars = {
    ...vars,
    currentYear: new Date().getFullYear().toString(),
  }

  const mjmlSource = getTemplateMjml(template, enrichedVars)
  const interpolated = interpolate(mjmlSource, enrichedVars)

  const { html, errors } = mjml2html(interpolated, {
    validationLevel: 'soft',
  })

  if (errors.length > 0) {
    console.warn(`[Email] MJML warnings for ${template}:`, errors.map((e: { message: string }) => e.message))
  }

  return {
    html,
    subject: interpolate(SUBJECTS[template], enrichedVars),
    text: interpolate(TEXT_BODIES[template], enrichedVars),
  }
}
