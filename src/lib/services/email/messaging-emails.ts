/**
 * Messaging Email Templates (NOTIF-04)
 *
 * Sends batched digest emails summarizing unread messages grouped by channel.
 * Message previews are truncated to 80 chars — no sensitive content in emails (T-28-11).
 */

import { sendViaResend, sendViaSmtp, getResendConfig, getSmtpConfig } from './transport'
import { logger } from '@/lib/logger'

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
          (p) =>
            `<tr>
              <td style="padding:4px 8px;color:#374151;font-size:14px;">
                <strong>${escapeHtml(p.author)}</strong>
                <span style="color:#6B7280;margin-left:8px;font-size:12px;">${escapeHtml(p.time)}</span>
                <br/>
                <span style="color:#4B5563;">${escapeHtml(p.text.slice(0, 80))}${p.text.length > 80 ? '...' : ''}</span>
              </td>
            </tr>`
        )
        .join('')

      return `
        <tr>
          <td style="padding:16px 0 4px 0;">
            <h3 style="margin:0;font-size:16px;color:#111827;">#${escapeHtml(ch.name)}</h3>
            <span style="font-size:13px;color:#6B7280;">${ch.unreadCount} unread message${ch.unreadCount === 1 ? '' : 's'}</span>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border-radius:8px;">
              ${previewRows}
            </table>
          </td>
        </tr>`
    })
    .join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:24px 24px 16px 24px;">
          <h2 style="margin:0 0 4px 0;font-size:20px;color:#111827;">Hi ${escapeHtml(input.userName)},</h2>
          <p style="margin:0;font-size:15px;color:#6B7280;">You have ${totalUnread} unread message${totalUnread === 1 ? '' : 's'} across ${input.channels.length} channel${input.channels.length === 1 ? '' : 's'}.</p>
        </td></tr>
        <tr><td style="padding:0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${channelBlocks}
          </table>
        </td></tr>
        <tr><td align="center" style="padding:24px;">
          <a href="${input.appUrl}/messaging" style="display:inline-block;padding:12px 32px;background:#4F46E5;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Open Messaging</a>
        </td></tr>
        <tr><td style="padding:0 24px 24px 24px;font-size:12px;color:#9CA3AF;text-align:center;">
          You're receiving this because you have email digests enabled. Adjust your notification preferences in the app.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

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
