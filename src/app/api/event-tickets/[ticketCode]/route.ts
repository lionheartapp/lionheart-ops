/**
 * GET /api/tickets/[ticketCode] — Public ticket lookup (no auth — the code IS the auth)
 *
 * Returns ticket data + QR code as base64 data URL for display.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
// eslint-disable-next-line no-restricted-imports -- public ticket lookup, no org context
import { rawPrisma } from '@/lib/db'
import QRCode from 'qrcode'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketCode: string }> }
) {
  const { ticketCode } = await params

  try {
    const ticket = await rawPrisma.eventTicket.findUnique({
      where: { ticketCode },
      include: {
        ticketType: { select: { name: true } },
        order: {
          select: {
            buyerName: true,
            formId: true,
            form: {
              select: {
                description: true,
                eventProjectId: true,
              },
            },
          },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })
    }

    // Get event details if linked
    let eventDate: string | null = null
    let eventVenue: string | null = null
    if (ticket.order.form.eventProjectId) {
      const event = await rawPrisma.eventProject.findUnique({
        where: { id: ticket.order.form.eventProjectId },
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

    // Generate QR code as data URL
    const verifyUrl = `${process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'}/api/event-tickets/${ticketCode}/verify`
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })

    return NextResponse.json(ok({
      ticketCode: ticket.ticketCode,
      status: ticket.status,
      ticketTypeName: ticket.ticketType.name,
      buyerName: ticket.order.buyerName,
      formTitle: ticket.order.form.description || 'Event',
      eventDate,
      eventVenue,
      checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
      qrDataUrl,
    }))
  } catch (error) {
    console.error('[ticket lookup]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to load ticket'), { status: 500 })
  }
}
