/**
 * Event Ticket Service — generates EventTicket records and sends confirmation emails.
 *
 * Called from the Stripe webhook when a FormOrder payment succeeds,
 * or directly for $0 orders.
 */

import { rawPrisma } from '@/lib/db'
import { getResendConfig, getAppUrl } from '@/lib/services/email/transport'
import crypto from 'crypto'

// ─── Ticket Code Generation ────────────────────────────────────────────────

/**
 * Generate a unique ticket code: TKT-XXXX-YYYY
 * Uses crypto.randomBytes for unpredictability.
 */
function generateTicketCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I confusion
  const bytes = crypto.randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length]
  }
  return `TKT-${code.slice(0, 4)}-${code.slice(4, 8)}`
}

// ─── Create Tickets for an Order ───────────────────────────────────────────

/**
 * Generate EventTicket records for a confirmed FormOrder.
 * Creates one ticket per unit (2× Adult = 2 ticket records).
 */
export async function generateTicketsForOrder(orderId: string): Promise<{
  tickets: Array<{ id: string; ticketCode: string; ticketTypeName: string }>
  order: { buyerName: string; buyerEmail: string; total: number; formId: string; organizationId: string }
}> {
  const order = await rawPrisma.formOrder.findUnique({
    where: { id: orderId },
    include: {
      lineItems: {
        include: { ticketType: { select: { id: true, name: true } } },
      },
    },
  })

  if (!order) throw new Error(`Order not found: ${orderId}`)

  const ticketsToCreate: Array<{
    organizationId: string
    orderId: string
    ticketTypeId: string
    ticketCode: string
  }> = []

  for (const item of order.lineItems) {
    for (let i = 0; i < item.quantity; i++) {
      ticketsToCreate.push({
        organizationId: order.organizationId,
        orderId: order.id,
        ticketTypeId: item.ticketTypeId,
        ticketCode: generateTicketCode(),
      })
    }
  }

  // Batch create tickets
  await rawPrisma.eventTicket.createMany({ data: ticketsToCreate })

  // Fetch the created tickets for the response
  const tickets = await rawPrisma.eventTicket.findMany({
    where: { orderId: order.id },
    include: { ticketType: { select: { name: true } } },
  })

  return {
    tickets: tickets.map((t) => ({
      id: t.id,
      ticketCode: t.ticketCode,
      ticketTypeName: t.ticketType.name,
    })),
    order: {
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      total: order.total,
      formId: order.formId,
      organizationId: order.organizationId,
    },
  }
}

// ─── Send Ticket Confirmation Email ────────────────────────────────────────

interface TicketEmailData {
  buyerName: string
  buyerEmail: string
  total: number
  tickets: Array<{ ticketCode: string; ticketTypeName: string }>
  formTitle: string
  eventDate?: string | null
  eventVenue?: string | null
}

export async function sendTicketConfirmationEmail(data: TicketEmailData): Promise<boolean> {
  const cfg = getResendConfig()
  if (!cfg) return false

  const appUrl = getAppUrl()
  const ticketListHtml = data.tickets.map((t) =>
    `<tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155;">${t.ticketTypeName}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-family: monospace; color: #6366f1;">
        <a href="${appUrl}/tickets/${t.ticketCode}" style="color: #6366f1; text-decoration: none;">${t.ticketCode}</a>
      </td>
    </tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 700;">You're all set!</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Your tickets are confirmed</p>
      </div>
      <div style="padding: 32px;">
        <p style="margin: 0 0 20px; font-size: 15px; color: #334155;">
          Hi ${data.buyerName.split(' ')[0]} — here are your tickets for <strong>${data.formTitle}</strong>.
        </p>
        ${data.eventDate ? `<p style="margin: 0 0 4px; font-size: 13px; color: #64748b;">📅 ${data.eventDate}</p>` : ''}
        ${data.eventVenue ? `<p style="margin: 0 0 20px; font-size: 13px; color: #64748b;">📍 ${data.eventVenue}</p>` : ''}
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Type</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Ticket Code</th>
            </tr>
          </thead>
          <tbody>${ticketListHtml}</tbody>
        </table>
        <p style="margin: 20px 0 0; font-size: 13px; color: #64748b;">
          Total paid: <strong style="color: #0f172a;">$${(data.total / 100).toFixed(2)}</strong>
        </p>
        <div style="text-align: center; margin: 28px 0 0;">
          <a href="${appUrl}/tickets/${data.tickets[0]?.ticketCode}" style="display: inline-block; padding: 12px 28px; background: #0f172a; color: white; text-decoration: none; border-radius: 999px; font-size: 14px; font-weight: 500;">
            View Your Tickets
          </a>
        </div>
        <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
          Show the QR code on your ticket at the door for entry.
        </p>
      </div>
    </div>
    <p style="text-align: center; margin: 20px 0 0; font-size: 11px; color: #cbd5e1;">Powered by Lionheart</p>
  </div>
</body>
</html>`

  const text = `Your tickets for ${data.formTitle} are confirmed.\n\n${data.tickets.map((t) => `${t.ticketTypeName}: ${t.ticketCode} — ${appUrl}/tickets/${t.ticketCode}`).join('\n')}\n\nTotal: $${(data.total / 100).toFixed(2)}`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [data.buyerEmail],
        subject: `Your tickets for ${data.formTitle}`,
        html,
        text,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Full Flow: Generate + Email ───────────────────────────────────────────

/**
 * Called after payment succeeds. Generates tickets, fetches form title, sends email.
 */
export async function fulfillOrder(orderId: string): Promise<void> {
  // Mark order as confirmed
  await rawPrisma.formOrder.update({
    where: { id: orderId },
    data: { status: 'CONFIRMED', paymentStatus: 'PAID', paidAt: new Date() },
  })

  // Generate tickets
  const { tickets, order } = await generateTicketsForOrder(orderId)

  // Get form title for the email
  const form = await rawPrisma.formDefinition.findUnique({
    where: { id: order.formId },
    select: { description: true, eventProjectId: true },
  })

  // If linked to an event, get event details
  let eventDate: string | null = null
  let eventVenue: string | null = null
  if (form?.eventProjectId) {
    const event = await rawPrisma.eventProject.findUnique({
      where: { id: form.eventProjectId },
      select: { startsAt: true, locationText: true, venueName: true },
    })
    if (event) {
      eventDate = event.startsAt.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
      eventVenue = event.venueName || event.locationText || null
    }
  }

  // Send confirmation email
  await sendTicketConfirmationEmail({
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    total: order.total,
    tickets,
    formTitle: form?.description || 'Event',
    eventDate,
    eventVenue,
  })
}
