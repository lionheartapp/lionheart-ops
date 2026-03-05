/**
 * Branded MJML email templates for Lionheart Platform.
 *
 * Brand: Primary blue #2563eb, headings Oswald, body Poppins.
 * All templates compile to production HTML via mjml at runtime.
 */

import mjml2html from 'mjml'

// ─── Brand Tokens ────────────────────────────────────────────────────────────

const BRAND = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#eff6ff',
  dark: '#111827',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',
  green: '#059669',
  greenLight: '#ecfdf5',
  red: '#dc2626',
  redLight: '#fef2f2',
  amber: '#d97706',
  amberLight: '#fffbeb',
  white: '#ffffff',
}

// ─── Shared Layout Wrapper ───────────────────────────────────────────────────

function wrapLayout(content: string, previewText: string): string {
  return `
<mjml>
  <mj-head>
    <mj-preview>${previewText}</mj-preview>
    <mj-font name="Poppins" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" />
    <mj-font name="Oswald" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&display=swap" />
    <mj-attributes>
      <mj-all font-family="Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" />
      <mj-text font-size="15px" line-height="1.6" color="${BRAND.gray700}" />
      <mj-button font-family="Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15px" font-weight="600" inner-padding="14px 32px" border-radius="10px" />
      <mj-section padding="0" />
      <mj-body background-color="${BRAND.gray50}" />
    </mj-attributes>
    <mj-style>
      .footer-link { color: ${BRAND.gray500} !important; text-decoration: underline; }
      .subtle { color: ${BRAND.gray500} !important; font-size: 13px !important; }
    </mj-style>
    <mj-style inline="inline">
      .heading { font-family: Oswald, 'Arial Narrow', Arial, sans-serif; font-weight: 600; letter-spacing: 0.02em; }
    </mj-style>
  </mj-head>
  <mj-body>
    <!-- Top spacer -->
    <mj-section padding="24px 0 0 0">
      <mj-column>
        <mj-spacer height="1px" />
      </mj-column>
    </mj-section>

    <!-- Header with logo bar -->
    <mj-section padding="28px 32px 20px 32px" background-color="${BRAND.dark}" border-radius="16px 16px 0 0" css-class="header">
      <mj-column>
        <mj-text align="center" font-size="22px" font-weight="600" color="${BRAND.white}" css-class="heading" letter-spacing="1.5px">
          {{orgName}}
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Accent bar -->
    <mj-section padding="0">
      <mj-column background-color="${BRAND.primary}" padding="0">
        <mj-spacer height="4px" />
      </mj-column>
    </mj-section>

    <!-- Main content card -->
    <mj-section background-color="${BRAND.white}" padding="36px 32px">
      <mj-column>
        ${content}
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="${BRAND.gray100}" padding="24px 32px" border-radius="0 0 16px 16px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="${BRAND.gray500}" line-height="1.5">
          Sent by {{orgName}} via Lionheart<br />
          <a href="{{appUrl}}" class="footer-link">Open Lionheart</a>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Bottom spacer -->
    <mj-section padding="0 0 24px 0">
      <mj-column>
        <mj-spacer height="1px" />
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`
}

// ─── Template Helpers ────────────────────────────────────────────────────────

function heading(text: string): string {
  return `<mj-text font-size="24px" font-weight="600" color="${BRAND.gray900}" css-class="heading" line-height="1.3" padding-bottom="8px">${text}</mj-text>`
}

function paragraph(html: string): string {
  return `<mj-text padding-bottom="16px">${html}</mj-text>`
}

function ctaButton(label: string, url: string, color = BRAND.primary): string {
  return `<mj-button href="${url}" background-color="${color}" color="${BRAND.white}" align="left">${label}</mj-button>`
}

function divider(): string {
  return `<mj-divider border-color="${BRAND.gray200}" border-width="1px" padding="16px 0" />`
}

function infoBox(content: string, bgColor = BRAND.primaryLight, borderColor = BRAND.primary): string {
  return `<mj-text padding="16px" background-color="${bgColor}" border-radius="8px" border-left="4px solid ${borderColor}" font-size="14px" line-height="1.5">${content}</mj-text>`
}

function subtle(text: string): string {
  return `<mj-text font-size="13px" color="${BRAND.gray500}" padding-top="16px">${text}</mj-text>`
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
    case 'welcome':
      return wrapLayout(
        [
          heading('Welcome aboard, {{firstName}}!'),
          paragraph(`Your account at <strong>{{orgName}}</strong> has been created. Set your password to get started and explore everything Lionheart has to offer.`),
          ctaButton('Set Your Password', '{{setupLink}}'),
          divider(),
          subtle('This link expires on {{expiresAt}}. If you didn\'t expect this email, you can safely ignore it.'),
        ].join('\n'),
        'Welcome to {{orgName}} — set your password to get started'
      )

    case 'password_setup':
      return wrapLayout(
        [
          heading('Complete your setup'),
          paragraph(`You've been invited to join <strong>{{orgName}}</strong> on Lionheart. Click below to set your password and complete your account setup.`),
          ctaButton('Set Your Password', '{{setupLink}}'),
          divider(),
          subtle('This link expires on {{expiresAt}}. If you didn\'t expect this invitation, you can safely ignore it.'),
        ].join('\n'),
        'You\'ve been invited to {{orgName}} — complete your setup'
      )

    case 'event_updated':
      return wrapLayout(
        [
          heading('Event rescheduled'),
          paragraph(`<strong>{{eventTitle}}</strong> has been rescheduled by {{updatedByName}}.`),
          infoBox(
            `<strong>New time</strong><br />${'{{eventDate}}'}<br />${'{{eventTime}}'}`,
          ),
          `<mj-spacer height="16px" />`,
          ctaButton('View Event', '{{eventLink}}'),
          subtle('You\'re receiving this because you\'re an attendee of this event.'),
        ].join('\n'),
        '{{eventTitle}} has been rescheduled'
      )

    case 'event_approved':
      return wrapLayout(
        [
          heading('Event approved'),
          paragraph(`Great news! Your event <strong>{{eventTitle}}</strong> has been approved.`),
          infoBox(
            `Approved via <strong>{{channelName}}</strong> channel.`,
            BRAND.greenLight,
            BRAND.green,
          ),
          `<mj-spacer height="16px" />`,
          ctaButton('View Event', '{{eventLink}}', BRAND.green),
        ].join('\n'),
        'Your event "{{eventTitle}}" has been approved'
      )

    case 'event_rejected':
      return wrapLayout(
        [
          heading('Event not approved'),
          paragraph(`Your event <strong>{{eventTitle}}</strong> was not approved.`),
          vars.reason
            ? infoBox(
                `<strong>Reason</strong><br />${'{{reason}}'}`,
                BRAND.redLight,
                BRAND.red,
              )
            : '',
          `<mj-spacer height="16px" />`,
          paragraph('You can edit your event and resubmit it for approval.'),
          ctaButton('View Event', '{{eventLink}}'),
        ].filter(Boolean).join('\n'),
        'Your event "{{eventTitle}}" was not approved'
      )

    case 'event_cancelled':
      return wrapLayout(
        [
          heading('Event cancelled'),
          paragraph(`The event <strong>{{eventTitle}}</strong> has been cancelled and removed from the calendar.`),
          infoBox(
            'This event is no longer scheduled. No further action is needed.',
            BRAND.gray100,
            BRAND.gray500,
          ),
          subtle('You\'re receiving this because you were an attendee of this event.'),
        ].join('\n'),
        '{{eventTitle}} has been cancelled'
      )

    case 'event_invite':
      return wrapLayout(
        [
          heading('You\'re invited'),
          paragraph(`You\'ve been added as an attendee to <strong>{{eventTitle}}</strong>.`),
          vars.eventDate
            ? infoBox(
                `<strong>When</strong><br />${'{{eventDate}}'}<br />${'{{eventTime}}'}`,
              )
            : '',
          `<mj-spacer height="16px" />`,
          ctaButton('View Event', '{{eventLink}}'),
        ].filter(Boolean).join('\n'),
        'You\'ve been added to "{{eventTitle}}"'
      )

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
  welcome: 'Welcome to {{orgName}}',
  password_setup: 'Complete your invitation to {{orgName}}',
  event_updated: 'Event rescheduled: {{eventTitle}}',
  event_approved: 'Event approved: {{eventTitle}}',
  event_rejected: 'Event not approved: {{eventTitle}}',
  event_cancelled: 'Event cancelled: {{eventTitle}}',
  event_invite: 'You\'re invited: {{eventTitle}}',
}

const TEXT_BODIES: Record<EmailTemplate, string> = {
  welcome: 'Welcome, {{firstName}}! Your account at {{orgName}} is ready. Set your password: {{setupLink}} (expires {{expiresAt}}).',
  password_setup: 'You\'ve been invited to {{orgName}}. Set your password: {{setupLink}} (expires {{expiresAt}}).',
  event_updated: '"{{eventTitle}}" was rescheduled by {{updatedByName}}. New time: {{eventDate}}, {{eventTime}}. View: {{eventLink}}',
  event_approved: 'Your event "{{eventTitle}}" was approved via {{channelName}} channel. View: {{eventLink}}',
  event_rejected: 'Your event "{{eventTitle}}" was not approved. {{reason}} View: {{eventLink}}',
  event_cancelled: '"{{eventTitle}}" has been cancelled and removed from the calendar.',
  event_invite: 'You\'ve been added to "{{eventTitle}}". View: {{eventLink}}',
}

/**
 * Render a branded email template.
 *
 * @param template - Which email to render
 * @param vars - Template variables (orgName, firstName, eventTitle, etc.)
 * @returns { html, subject, text } ready to send
 */
export function renderEmail(template: EmailTemplate, vars: TemplateVars): RenderEmailResult {
  const mjmlSource = getTemplateMjml(template, vars)
  const interpolated = interpolate(mjmlSource, vars)

  const { html, errors } = mjml2html(interpolated, {
    minify: true,
    validationLevel: 'soft',
  })

  if (errors.length > 0) {
    console.warn(`[Email] MJML warnings for ${template}:`, errors.map((e: { message: string }) => e.message))
  }

  return {
    html,
    subject: interpolate(SUBJECTS[template], vars),
    text: interpolate(TEXT_BODIES[template], vars),
  }
}
