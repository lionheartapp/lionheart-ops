/**
 * POST /api/public/tickets/qr/[token]
 *
 * Public endpoint — submit a ticket via QR code. No auth required.
 * The token determines the org and pre-filled scope.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { resolveQrToken } from '@/lib/services/formQrService'
// eslint-disable-next-line no-restricted-imports -- Public QR ticket intake resolves organization from token and manually scopes every lookup/write by resolved.organizationId.
import { rawPrisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'
import { z } from 'zod'

const qrTicketSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  categoryKey: z.string().min(1).optional(),
  priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).default('Normal'),
  locationText: z.string().max(500).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  submitterName: z.string().max(200).optional(),
  submitterEmail: z.string().email().max(200).optional(),
})

type RouteParams = { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    const resolved = await resolveQrToken(token)
    if (!resolved) {
      return NextResponse.json(
        fail('NOT_FOUND', 'This QR code is no longer active.'),
        { status: 404 }
      )
    }

    const body = await req.json()
    const parsed = qrTicketSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid ticket data', parsed.error.issues),
        { status: 400 }
      )
    }

    const data = parsed.data
    const categoryKey = resolved.categoryKey ?? data.categoryKey ?? 'OTHER'

    // Build location text from resolved scope
    let locationText = data.locationText ?? ''
    if (!locationText && (resolved.buildingId || resolved.roomId)) {
      const parts: string[] = []
      if (resolved.buildingId) {
        const b = await rawPrisma.building.findFirst({
          where: {
            id: resolved.buildingId,
            organizationId: resolved.organizationId,
          },
          select: { name: true },
        })
        if (b) parts.push(b.name)
      }
      if (resolved.roomId) {
        const r = await rawPrisma.room.findFirst({
          where: {
            id: resolved.roomId,
            organizationId: resolved.organizationId,
          },
          select: { roomNumber: true, displayName: true },
        })
        if (r) parts.push(r.displayName ?? r.roomNumber)
      }
      locationText = parts.join(' — ')
    }

    // Create the IT ticket in org context
    const ticket = await runWithOrgContext(resolved.organizationId, async () => {
      // Use rawPrisma for creation since we manually set organizationId
      const counter = await rawPrisma.iTTicketCounter.upsert({
        where: { organizationId: resolved.organizationId },
        create: { organizationId: resolved.organizationId, lastTicketNumber: 1 },
        update: { lastTicketNumber: { increment: 1 } },
      })

      return (rawPrisma.iTTicket.create as Function)({
        data: {
          organizationId: resolved.organizationId,
          ticketNumber: `IT-${String(counter.lastTicketNumber).padStart(4, '0')}`,
          title: data.title,
          description: data.description,
          issueType: categoryKey.toUpperCase(),
          priority: data.priority.toUpperCase(),
          status: 'OPEN',
          source: 'QR_CODE',
          locationText,
          buildingId: resolved.buildingId,
          spaceId: resolved.spaceId,
          roomId: resolved.roomId,
          customFields: data.customFields ?? undefined,
          submitterName: data.submitterName ?? 'QR Submission',
          submitterEmail: data.submitterEmail ?? null,
        },
        select: { id: true, ticketNumber: true },
      })
    })

    return NextResponse.json(ok(ticket), { status: 201 })
  } catch {
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong'),
      { status: 500 }
    )
  }
}
