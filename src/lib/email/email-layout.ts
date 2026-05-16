/**
 * Shared email layout, brand tokens, and MJML helpers.
 *
 * Design: lionheartapp.com aesthetic — near-black on warm white, Inter,
 * monochrome restraint with subtle hairline borders and soft cards.
 * Logo bar -> hairline -> hero content -> optional dark band -> footer.
 */

// ─── Brand Tokens ────────────────────────────────────────────────────────────

export const B = {
  // ── New primary palette (lionheartapp.com style) ──
  nearBlack: '#0f0f0f',
  textSec: '#5a5a5a',
  textMute: '#9a9a9a',
  border: '#e7e7e6',
  borderSoft: '#efefee',
  surface: '#ffffff',
  surfaceAlt: '#fafaf9',
  surfaceWarm: '#fdfcfb',

  // ── Status palettes ──
  green: '#047857',
  greenLight: '#ecfdf5',
  red: '#b91c1c',
  redLight: '#fef2f2',
  amber: '#b45309',
  amberLight: '#fffbeb',
  gray50: '#f7f7f6',

  // ── Legacy tokens kept for back-compat (some templates still reference) ──
  blue: '#1d4ed8',
  blueDark: '#1e3a8a',
  blueLight: '#fafaf9',
  dark: '#0f0f0f',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9a9a9a',
  gray500: '#5a5a5a',
  gray700: '#374151',
  gray900: '#111827',
  white: '#ffffff',
} as const

// Hosted logo — PNG fallback for email clients without inline SVG support
const LOGO_URL = '{{appUrl}}/email/logo-color.png'

// Inline logo mark (rendered as a 36px near-black square with white "L")
// Email-safe: uses table + bgcolor, works in Gmail/Outlook/Apple Mail.
const FONT_STACK = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

// ─── Shared Layout ──────────────────────────────────────────────────────────

interface BlueBandOpts {
  text: string
  ctaLabel?: string
  ctaUrl?: string
}

interface WrapLayoutOpts {
  previewText: string
  content: string
  /** Optional dark band section below main content (named "blueBand" for back-compat). */
  blueBand?: BlueBandOpts
}

/**
 * Full layout: logo bar, hairline, content, optional dark band, footer.
 */
export function wrapLayout(opts: Readonly<WrapLayoutOpts>): string {
  const bandMjml = opts.blueBand
    ? `
    <!-- Dark band section -->
    <mj-section background-color="${B.nearBlack}" padding="40px 32px" border-radius="0">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="16px" line-height="1.55" padding-bottom="${opts.blueBand.ctaLabel ? '20px' : '0'}">
          ${opts.blueBand.text}
        </mj-text>
        ${opts.blueBand.ctaLabel
          ? `<mj-button href="${opts.blueBand.ctaUrl || '{{appUrl}}'}" background-color="#ffffff" color="${B.nearBlack}" align="center" border-radius="8px" inner-padding="12px 22px" font-size="14px" font-weight="600">
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
      .logo-mark { font-family: ${FONT_STACK}; font-weight: 800; }
    </mj-style>
    <mj-style>
      :root { color-scheme: light only; }
      .footer-link { color: ${B.textSec} !important; text-decoration: none; font-size: 12px; font-weight: 500; }
      a { color: ${B.nearBlack}; }
      [data-ogsc] body, [data-ogsb] body { background-color: ${B.surfaceWarm} !important; color: ${B.nearBlack} !important; }
      @media (prefers-color-scheme: dark) {
        body, .body { background-color: ${B.surfaceWarm} !important; }
        h1, h2, h3, p, td, th, div, span { color: inherit !important; }
      }
    </mj-style>
  </mj-head>
  <mj-body background-color="${B.surfaceWarm}">

    <!-- Logo bar (single column + table for tight horizontal layout) -->
    <mj-section background-color="${B.surface}" padding="24px 32px 16px 32px">
      <mj-column>
        <mj-text padding="0" align="left" font-size="16px" font-weight="700" color="${B.nearBlack}" line-height="34px">
          <table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
            <td bgcolor="${B.nearBlack}" width="34" height="34" align="center" valign="middle" style="background:${B.nearBlack};border-radius:8px;color:#ffffff;font-family:${FONT_STACK};font-size:16px;font-weight:800;line-height:34px;letter-spacing:-0.02em;">
              <a href="{{appUrl}}" style="color:#ffffff;text-decoration:none;display:block;width:34px;height:34px;line-height:34px;">L</a>
            </td>
            <td style="padding-left:12px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:${B.nearBlack};letter-spacing:-0.01em;line-height:34px;">
              <img src="${LOGO_URL}" alt="" width="0" height="0" style="display:none;width:0;height:0;max-height:0;overflow:hidden;" />Lionheart
            </td>
          </tr></table>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Hairline under logo -->
    <mj-section background-color="${B.surface}" padding="0 32px">
      <mj-column>
        <mj-divider border-color="${B.border}" border-width="1px" padding="0" />
      </mj-column>
    </mj-section>

    <!-- Main content -->
    ${opts.content}

    ${bandMjml}

    <!-- Footer -->
    <mj-section background-color="${B.surfaceWarm}" padding="28px 32px 8px 32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="${B.textSec}" line-height="1.6">
          <a href="{{appUrl}}" class="footer-link">Open app</a>
          &nbsp;·&nbsp;
          <a href="{{appUrl}}/settings/notifications" class="footer-link">Notification settings</a>
          &nbsp;·&nbsp;
          <a href="{{appUrl}}/help" class="footer-link">Help center</a>
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="${B.surfaceWarm}" padding="0 32px 28px 32px">
      <mj-column>
        <mj-text align="center" font-size="11px" color="${B.textMute}" line-height="1.5">
          &copy; {{currentYear}} Lionheart Educational Operations · lionheartapp.com<br />
          Made for schools, districts, and teams that run on details.
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>`
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Hero block: small eyebrow + large headline.
 * `<br />` in the headline is supported for visual line breaks.
 */
export function heroHeading(subtitle: string, headline: string): string {
  return `
    <mj-section background-color="${B.surface}" padding="36px 32px 0 32px">
      <mj-column>
        <mj-text align="left" font-size="12px" color="${B.textSec}" css-class="subheading" padding="0 0 10px 0">
          ${subtitle}
        </mj-text>
        <mj-text align="left" font-size="30px" font-weight="700" color="${B.nearBlack}" css-class="heading" line-height="1.18" padding="0 0 14px 0">
          ${headline}
        </mj-text>
      </mj-column>
    </mj-section>`
}

/**
 * Solid CTA button. Default is near-black (matches lionheartapp.com).
 * Pass a hex color string to override (e.g. B.green, B.red).
 */
export function centeredCta(label: string, url: string, color: string = B.nearBlack): string {
  return `
    <mj-section background-color="${B.surface}" padding="6px 32px 12px 32px">
      <mj-column>
        <mj-button href="${url}" background-color="${color}" color="${B.white}" align="left" border-radius="8px" inner-padding="12px 22px" padding="0" font-size="14.5px" font-weight="600">
          ${label}
        </mj-button>
      </mj-column>
    </mj-section>`
}

/**
 * Generic content section wrapper.
 * Default padding (24px 40px) preserved for back-compat with existing callers.
 */
export function contentSection(html: string, padding = '24px 40px'): string {
  return `
    <mj-section background-color="${B.surface}" padding="${padding}">
      <mj-column>
        ${html}
      </mj-column>
    </mj-section>`
}

/**
 * Card/detail block with border-radius: 12px.
 * Color variants are achieved by passing custom bg + accent colors.
 */
export function detailCard(content: string, bgColor: string = B.surfaceAlt, accentColor: string = B.border): string {
  return `
    <mj-section background-color="${B.surface}" padding="12px 32px 16px 32px">
      <mj-column>
        <mj-text padding="0" align="left">
          <div style="background-color: ${bgColor}; border: 1px solid ${accentColor}; border-radius: 12px; padding: 18px 20px; text-align: left; font-family: ${FONT_STACK}; color: ${B.nearBlack};">
            <span style="font-size: 14.5px; line-height: 1.7; color: ${B.nearBlack};">${content}</span>
          </div>
        </mj-text>
      </mj-column>
    </mj-section>`
}

/**
 * Lede paragraph — main body copy below the hero headline.
 */
export function ledeText(html: string): string {
  return `
    <mj-section background-color="${B.surface}" padding="0 32px 6px 32px">
      <mj-column>
        <mj-text padding="0" align="left" font-size="16px" line-height="1.55" color="${B.textSec}">
          ${html}
        </mj-text>
      </mj-column>
    </mj-section>`
}

/**
 * Small muted microcopy line — used for fine print / "this link expires…" notes.
 */
export function microNote(html: string): string {
  return `
    <mj-section background-color="${B.surface}" padding="6px 32px 16px 32px">
      <mj-column>
        <mj-text padding="0" align="left" font-size="13px" line-height="1.5" color="${B.textMute}">
          ${html}
        </mj-text>
      </mj-column>
    </mj-section>`
}

export function heroImage(src: string, alt: string): string {
  return `
    <mj-section background-color="${B.surface}" padding="16px 0 0 0">
      <mj-column>
        <mj-image src="${src}" alt="${alt}" width="600px" padding="0" />
      </mj-column>
    </mj-section>`
}
