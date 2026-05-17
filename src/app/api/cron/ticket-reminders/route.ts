/**
 * GET /api/cron/ticket-reminders — Send day-before reminder emails for ticketed events
 *
 * Called by Vercel Cron daily. Finds events happening tomorrow that have
 * confirmed FormOrders with tickets, and sends a reminder email to each buyer.
 *
 * Protected by CRON_SECRET header check.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
// eslint-disable-next-line no-restricted-imports -- cron job, no org context
import { rawPrisma } from '@/lib/db'
import { getResendConfig, getAppUrl } from '@/lib/services/email/transport'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  const cfg = getResendConfig()
  if (!cfg) {
    return NextResponse.json(ok({ sent: 0, reason: 'No email provider configured' }))
  }

  const appUrl = getAppUrl()

  // Find events happening tomorrow (within 24-48 hours from now)
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  // Get forms linked to events starting tomorrow
  const forms = await rawPrisma.formDefinition.findMany({
    where: {
      eventProjectId: { not: null },
      ticketTypes: { some: {} }, // has ticket types
    },
    select: {
      id: true,
      description: true,
      eventProject: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          locationText: true,
          venueName: true,
        },
      },
    },
  })

  // Filter to events happening tomorrow
  const tomorrowForms = forms.filter((f) => {
    if (!f.eventProject) return false
    const eventStart = new Date(f.eventProject.startsAt)
    return eventStart >= tomorrow && eventStart < dayAfter
  })

  let totalSent = 0

  for (const form of tomorrowForms) {
    if (!form.eventProject) continue

    // Get all confirmed orders for this form
    const orders = await rawPrisma.formOrder.findMany({
      where: { formId: form.id, status: 'CONFIRMED' },
      select: {
        buyerName: true,
        buyerEmail: true,
        tickets: {
          select: { ticketCode: true },
          take: 1, // just need one for the link
        },
      },
    })

    const event = form.eventProject
    const eventDate = new Date(event.startsAt).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
    const venue = event.venueName || event.locationText || ''

    for (const order of orders) {
      if (!order.tickets[0]) continue

      const ticketLink = `${appUrl}/tickets/${order.tickets[0].ticketCode}`
      const firstName = order.buyerName.split(' ')[0]

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px;">
      <h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">See you tomorrow!</h1>
      <p style="margin: 0 0 20px; font-size: 15px; color: #334155;">
        Hi ${firstName} — just a reminder that <strong>${event.title}</strong> is tomorrow.
      </p>
      <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin: 0 0 24px;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #334155;"><strong>📅 ${eventDate}</strong></p>
        ${venue ? `<p style="margin: 0; font-size: 14px; color: #64748b;">📍 ${venue}</p>` : ''}
      </div>
      <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">
        Have your ticket ready — show the QR code at the door for entry.
      </p>
      <div style="text-align: center;">
        <a href="${ticketLink}" style="display: inline-block; padding: 12px 28px; background: #0f172a; color: white; text-decoration: none; border-radius: 999px; font-size: 14px; font-weight: 500;">
          View Your Tickets
        </a>
      </div>
    </div>
    <p style="text-align: center; margin: 20px 0 0; font-size: 11px; color: #cbd5e1;">Powered by Lionheart</p>
  </div>
</body>
</html>`

      const text = `Reminder: ${event.title} is tomorrow!\n\n${eventDate}\n${venue}\n\nView your tickets: ${ticketLink}`

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: cfg.from,
            to: [order.buyerEmail],
            subject: `Reminder: ${event.title} is tomorrow!`,
            html,
            text,
          }),
        })
        if (res.ok) totalSent++
      } catch {
        // Continue to next — don't fail the whole job
      }
    }
  }

  return NextResponse.json(ok({ sent: totalSent, eventsProcessed: tomorrowForms.length }))
}
