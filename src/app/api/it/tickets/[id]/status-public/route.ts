/**
 * GET /api/it/tickets/:id/status-public — public ticket status lookup via token
 */
// Public endpoint — no auth required (token-based status lookup)

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
// eslint-disable-next-line no-restricted-imports -- Public ticket status route verifies the hashed status token before returning non-internal ticket activity.
import { rawPrisma } from '@/lib/db'
import { createHash } from 'crypto'
import { logger } from '@/lib/logger'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Token is required'), { status: 400 })
    }

    const tokenHash = createHash('sha256').update(token).digest('hex')

    const ticket = await rawPrisma.iTTicket.findFirst({
      where: { id, statusToken: tokenHash, deletedAt: null },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        issueType: true,
        createdAt: true,
        updatedAt: true,
        activities: {
          where: { isInternal: false },
          select: {
            id: true,
            type: true,
            content: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json(fail('NOT_FOUND', 'Ticket not found or invalid token'), { status: 404 })
    }

    return NextResponse.json(ok({
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      status: ticket.status,
      issueType: ticket.issueType,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      timeline: ticket.activities,
    }))
  } catch (error) {
    logger.error({ error: String(error) }, 'Failed to get public ticket status')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
