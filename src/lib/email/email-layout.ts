/**
 * Shared email layout, brand tokens, and MJML helpers.
 *
 * Design: Wix-style clean layout with Lionheart as the sender brand.
 * Logo -> divider -> hero content -> optional blue band -> footer.
 * Brand: Primary blue #1d4ed8, headings Oswald, body Poppins.
 */

// ─── Brand Tokens ────────────────────────────────────────────────────────────

export const B = {
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
export function wrapLayout(opts: {
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

export function heroHeading(subtitle: string, headline: string): string {
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

export function centeredCta(label: string, url: string, color = B.blue): string {
  return `
    <mj-section background-color="${B.white}" padding="0 40px 8px 40px">
      <mj-column>
        <mj-button href="${url}" background-color="${color}" color="${B.white}" align="center" border-radius="24px" inner-padding="14px 40px">
          ${label}
        </mj-button>
      </mj-column>
    </mj-section>`
}

export function contentSection(html: string, padding = '24px 40px'): string {
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
export function detailCard(content: string, bgColor = B.blueLight, accentColor = B.blue): string {
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

export function heroImage(src: string, alt: string): string {
  return `
    <mj-section background-color="${B.white}" padding="16px 0 0 0">
      <mj-column>
        <mj-image src="${src}" alt="${alt}" width="600px" padding="0" />
      </mj-column>
    </mj-section>`
}
