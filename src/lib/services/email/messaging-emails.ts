/**
 * Messaging Email Templates (NOTIF-04)
 *
 * Sends batched digest emails summarizing unread messages grouped by channel.
 * Message previews are truncated to 80 chars — no sensitive content in emails (T-28-11).
 */

import { sendViaResend, sendViaSmtp, getResendConfig, getSmtpConfig } from './transport'
import { logger } from '@/lib/logger'
import { wrapInlineLayout, inlineHero, inlineCta, inlineMicro } from '@/lib/email/inline-layout'
import { B } from '@/lib/email/email-layout'

const log = logger.child({ service: 'messagingEmails' })

// ─── Types ────────────────────────────────────────────────────────────

interface MessagePreview {
  author: string
  text: string
  time: string
}

interface ChannelDigest {
  name: string
  unreadCount: number
  previews: MessagePreview[]
}

interface SendDigestInput {
  to: string
  userName: string
  channels: ChannelDigest[]
  appUrl: string
}

// ─── Email Builder ────────────────────────────────────────────────────

function buildDigestHtml(input: SendDigestInput): { subject: string; html: string; text: string } {
  const totalUnread = input.channels.reduce((sum, ch) => sum + ch.unreadCount, 0)
  const subject = `Your messaging digest — ${totalUnread} unread message${totalUnread === 1 ? '' : 's'}`

  const channelBlocks = input.channels
    .map((ch) => {
      const previewRows = ch.previews
        .map(
          (p, i) =>
            `<div style="padding:12px 0;${i === 0 ? '' : `border-top:1px solid ${B.borderSoft};`}">
              <div style="font-size:13.5px;font-weight:600;color:${B.nearBlack};margin-bottom:2px;">${escapeHtml(p.author)} <span style="color:${B.textMute};font-weight:500;font-size:11px;margin-left:6px;">· ${escapeHtml(p.time)}</span></div>
              <div style="font-size:14px;color:${B.textSec};line-height:1.5;">${escapeHtml(p.text.slice(0, 80))}${p.text.length > 80 ? '…' : ''}</div>
            </div>`
        )
        .join('')

      return `<div style="padding:12px 32px 4px 32px;">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;">
          <span style="font-size:14.5px;font-weight:600;color:${B.nearBlack};">#${escapeHtml(ch.name)}</span>
          <span style="font-size:12px;color:${B.textMute};font-weight:500;">${ch.unreadCount} unread</span>
        </div>
        <div style="background:${B.surfaceAlt};border:1px solid ${B.border};border-radius:12px;padding:4px 16px;">
          ${previewRows}
        </div>
      </div>`
    })
    .join('')

  const channelCount = input.channels.length
  const html = wrapInlineLayout({
    appUrl: input.appUrl,
    content: [
      `<div style="padding:36px 32px 6px 32px;">
        <div style="font-size:12px;font-weight:600;color:${B.textSec};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Daily digest</div>
        <h1 style="margin:0 0 14px;font-size:30px;font-weight:700;line-height:1.18;letter-spacing:-0.022em;color:${B.nearBlack};">${totalUnread} message${totalUnread === 1 ? '' : 's'} you missed.</h1>
        <p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:${B.textSec};">Hi ${escapeHtml(input.userName)} — here's what came in while you were away, across ${channelCount} channel${channelCount === 1 ? '' : 's'}.</p>
      </div>`,
      channelBlocks,
      inlineCta('Open messaging', `${input.appUrl}/messaging`),
      inlineMicro(`Want a different cadence? <a href="${input.appUrl}/settings/notifications" style="color:${B.textSec};text-decoration:underline;">Adjust digest settings</a>.`),
    ].join(''),
  })

  const textLines = [`Hi ${input.userName},\n`, `You have ${totalUnread} unread message(s):\n`]
  for (const ch of input.channels) {
    textLines.push(`\n#${ch.name} — ${ch.unreadCount} unread`)
    for (const p of ch.previews) {
      textLines.push(`  ${p.author} (${p.time}): ${p.text.slice(0, 80)}`)
    }
  }
  textLines.push(`\nOpen Messaging: ${input.appUrl}/messaging`)
  const text = textLines.join('\n')

  return { subject, html, text }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Send a messaging digest email to a user with their unread channel summaries.
 */
export async function sendMessagingDigest(input: SendDigestInput): Promise<void> {
  const { subject, html, text } = buildDigestHtml(input)
  const from =
    getResendConfig()?.from || getSmtpConfig()?.from || 'Lionheart <no-reply@lionheartapp.com>'

  const resendResult = await sendViaResend(input.to, subject, html, text, from)
  if (resendResult.sent) return

  const smtpResult = await sendViaSmtp(input.to, subject, html, text, from)
  if (smtpResult.sent) return

  log.error({ to: input.to }, 'Failed to send messaging digest — no email provider succeeded')
}
