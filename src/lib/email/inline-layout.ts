/**
 * Inline HTML layout for emails that don't go through the MJML pipeline
 * (board reports with PDF attachments, contact form, compliance, messaging digest).
 *
 * Matches the lionheartapp.com aesthetic: near-black on warm white, Inter,
 * subtle hairlines, soft cards, near-black CTAs. Mirrors templates.ts.
 */

import { B } from './email-layout'

const FONT_STACK = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

interface InlineLayoutOpts {
  appUrl: string
  /** Inner content HTML — full markup, no <body> wrapper needed. */
  content: string
}

/** Wrap content with the standard logo bar, hairline, and footer. */
export function wrapInlineLayout(opts: Readonly<InlineLayoutOpts>): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${B.surfaceWarm};font-family:${FONT_STACK};color:${B.nearBlack};-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${B.surfaceWarm};padding:24px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${B.surface};border-radius:14px;overflow:hidden;box-shadow:0 0 0 1px rgba(34,42,53,0.06),0 4px 18px rgba(0,0,0,0.04);">
      <!-- Logo bar -->
      <tr><td style="padding:24px 32px 16px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${B.nearBlack}" width="34" height="34" align="center" valign="middle" style="background:${B.nearBlack};border-radius:8px;color:#ffffff;font-size:16px;font-weight:800;line-height:34px;letter-spacing:-0.02em;">
              <a href="${opts.appUrl}" style="color:#ffffff;text-decoration:none;display:block;width:34px;height:34px;line-height:34px;font-family:${FONT_STACK};">L</a>
            </td>
            <td style="padding-left:12px;font-size:16px;font-weight:700;color:${B.nearBlack};letter-spacing:-0.01em;">Lionheart</td>
          </tr>
        </table>
      </td></tr>
      <!-- Hairline -->
      <tr><td style="padding:0 32px;"><div style="height:1px;background:${B.border};line-height:1px;font-size:0;">&nbsp;</div></td></tr>
      <!-- Content -->
      <tr><td style="padding:0;">${opts.content}</td></tr>
    </table>

    <!-- Footer -->
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;margin-top:8px;">
      <tr><td align="center" style="padding:20px 24px 6px 24px;font-size:12px;color:${B.textSec};">
        <a href="${opts.appUrl}" style="color:${B.textSec};text-decoration:none;font-weight:500;">Open app</a>
        &nbsp;·&nbsp;
        <a href="${opts.appUrl}/settings/notifications" style="color:${B.textSec};text-decoration:none;font-weight:500;">Notification settings</a>
        &nbsp;·&nbsp;
        <a href="${opts.appUrl}/help" style="color:${B.textSec};text-decoration:none;font-weight:500;">Help center</a>
      </td></tr>
      <tr><td align="center" style="padding:0 24px 24px 24px;font-size:11px;color:${B.textMute};line-height:1.5;">
        &copy; ${year} Lionheart Educational Operations · lionheartapp.com<br>
        Made for schools, districts, and teams that run on details.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

/** Hero block (eyebrow + headline + lede). */
export function inlineHero(eyebrow: string, headline: string, lede: string): string {
  return `<div style="padding:36px 32px 6px 32px;">
    <div style="font-size:12px;font-weight:600;color:${B.textSec};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">${eyebrow}</div>
    <h1 style="margin:0 0 14px;font-size:30px;font-weight:700;line-height:1.18;letter-spacing:-0.022em;color:${B.nearBlack};">${headline}</h1>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:${B.textSec};">${lede}</p>
  </div>`
}

/** Solid CTA button. */
export function inlineCta(label: string, href: string, color: string = B.nearBlack): string {
  return `<div style="padding:6px 32px 16px 32px;">
    <a href="${href}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14.5px;font-weight:600;font-family:${FONT_STACK};">${label}</a>
  </div>`
}

/** Microcopy (fine print). */
export function inlineMicro(html: string): string {
  return `<div style="padding:6px 32px 16px 32px;font-size:13px;line-height:1.5;color:${B.textMute};">${html}</div>`
}

/** Card with key/value rows. Pass `bgColor`/`borderColor` for status variants. */
export function inlineKvCard(
  rows: ReadonlyArray<readonly [string, string]>,
  bgColor: string = B.surfaceAlt,
  borderColor: string = B.border
): string {
  const inner = rows
    .map(
      ([k, v], i) =>
        `<tr><td style="padding:8px 0;${i === 0 ? '' : `border-top:1px solid ${B.borderSoft};`}color:${B.textSec};font-size:13.5px;font-weight:500;">${k}</td><td align="right" style="padding:8px 0;${i === 0 ? '' : `border-top:1px solid ${B.borderSoft};`}color:${B.nearBlack};font-size:14px;font-weight:600;">${v}</td></tr>`
    )
    .join('')
  return `<div style="padding:12px 32px 16px 32px;"><div style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;padding:14px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${inner}</table></div></div>`
}

/** Plain content card (e.g. for free-form text like a contact-form message). */
export function inlineCard(html: string, bgColor: string = B.surfaceAlt, borderColor: string = B.border): string {
  return `<div style="padding:12px 32px 16px 32px;"><div style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;padding:16px 18px;font-size:14.5px;line-height:1.6;color:${B.nearBlack};">${html}</div></div>`
}

/** Status pill (small inline badge). */
export function inlinePill(label: string, variant: 'green' | 'red' | 'amber' | 'gray' = 'gray'): string {
  const palette = {
    green: { bg: B.greenLight, fg: B.green },
    red: { bg: B.redLight, fg: B.red },
    amber: { bg: B.amberLight, fg: B.amber },
    gray: { bg: B.gray50, fg: B.textSec },
  }[variant]
  return `<span style="display:inline-block;background:${palette.bg};color:${palette.fg};padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;">${label}</span>`
}
