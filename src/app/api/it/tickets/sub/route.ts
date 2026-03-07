/**
 * POST /api/it/tickets/sub — Submit IT ticket via magic link (no auth required)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'
import { createSubTicket, SubTicketSchema } from '@/lib/services/itTicketService'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, ...ticketData } = body

    if (!token) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Magic link token is required'), { status: 400 })
    }

    // Validate token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const magicLink = await rawPrisma.iTMagicLink.findUnique({
      where: { tokenHash },
    })

    if (!magicLink) {
      return NextResponse.json(fail('INVALID_TOKEN', 'This link is not valid.'), { status: 404 })
    }

    if (magicLink.usedAt) {
      return NextResponse.json(fail('TOKEN_USED', 'This link has already been used.'), { status: 410 })
    }

    if (magicLink.expiresAt < new Date()) {
      return NextResponse.json(fail('TOKEN_EXPIRED', 'This link has expired.'), { status: 410 })
    }

    // Validate ticket data
    const validated = SubTicketSchema.parse(ticketData)

    // Mark token as used
    await rawPrisma.iTMagicLink.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    })

    // Create ticket in org context
    const ticket = await runWithOrgContext(magicLink.organizationId, () =>
      createSubTicket(validated, magicLink.organizationId, magicLink.schoolId || undefined)
    )

    return NextResponse.json(ok({ ticketNumber: ticket.ticketNumber }), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data'), { status: 400 })
    }
    console.error('[POST /api/it/tickets/sub]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
