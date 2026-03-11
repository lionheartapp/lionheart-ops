/**
 * POST /api/ai/assistant/confirm — Execute a confirmed AI assistant action
 *
 * After the AI drafts an action and the user confirms via the UI,
 * this endpoint actually performs the write operation using existing services.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { createEvent } from '@/lib/services/eventService'
import { prisma } from '@/lib/db'

const ConfirmSchema = z.object({
  action: z.string(),
  payload: z.record(z.string(), z.unknown()),
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function nullToUndef(v: string | null): string | undefined {
  return v === null ? undefined : v
}

/** Ensure a date string is full ISO 8601 (with Z suffix) for Zod .datetime() */
function ensureISODate(dateStr: string): string {
  if (!dateStr) return dateStr
  // If it already has timezone info, return as-is
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) return dateStr
  // Try to parse and convert to ISO
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? dateStr : d.toISOString()
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { action, payload } = ConfirmSchema.parse(await req.json())

    return await runWithOrgContext(orgId, async () => {
      switch (action) {
        // ── Create Maintenance Ticket ──────────────────────────────────
        case 'create_maintenance_ticket': {
          await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_SUBMIT)
          const { createMaintenanceTicket } = await import('@/lib/services/maintenanceTicketService')
          const ticket = await createMaintenanceTicket({
            title: String(payload.title || ''),
            description: String(payload.description || ''),
            category: String(payload.category || 'OTHER') as any,
            priority: String(payload.priority || 'MEDIUM') as any,
          }, ctx.userId, orgId)
          return NextResponse.json(ok({
            success: true,
            message: `Maintenance ticket ${(ticket as any).ticketNumber || ''} created: "${(ticket as any).title}"`,
          }))
        }

        // ── Create Event ───────────────────────────────────────────────
        case 'create_event': {
          await assertCan(ctx.userId, PERMISSIONS.EVENTS_CREATE)
          const event = await createEvent({
            title: String(payload.title || ''),
            description: String(payload.description || '') || undefined,
            room: String(payload.room || '') || undefined,
            startsAt: ensureISODate(String(payload.startsAt)),
            endsAt: ensureISODate(String(payload.endsAt)),
          }, ctx.userId)
          return NextResponse.json(ok({
            success: true,
            message: `Event created: "${event.title}" on ${new Date(event.startsAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}`,
          }))
        }

        // ── Create IT Ticket ───────────────────────────────────────────
        case 'create_it_ticket': {
          await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_SUBMIT)
          const { createITTicket } = await import('@/lib/services/itTicketService')
          const ticket = await createITTicket({
            title: String(payload.title || ''),
            description: String(payload.description || '') || undefined,
            issueType: String(payload.issueType || 'OTHER') as any,
            priority: String(payload.priority || 'MEDIUM') as any,
            photos: [],
          }, ctx.userId, orgId)
          return NextResponse.json(ok({
            success: true,
            message: `IT ticket ${(ticket as any).ticketNumber || ''} created: "${(ticket as any).title}"`,
          }))
        }

        // ── Update Maintenance Ticket Status ───────────────────────────
        case 'update_maintenance_ticket_status': {
          await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_UPDATE_ALL)
          const ticketId = String(payload.ticketId)
          const newStatus = String(payload.newStatus) as any

          let ticket = await prisma.maintenanceTicket.findUnique({ where: { id: ticketId }, select: { id: true } }).catch(() => null)
          if (!ticket) {
            ticket = await prisma.maintenanceTicket.findFirst({
              where: { ticketNumber: { equals: ticketId, mode: 'insensitive' } },
              select: { id: true },
            }).catch(() => null)
          }
          if (!ticket) return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })

          const updated = await prisma.maintenanceTicket.update({
            where: { id: ticket.id },
            data: {
              status: newStatus,
              ...(payload.note ? { completionNote: String(payload.note) } : {}),
            },
            select: { ticketNumber: true, title: true, status: true },
          })
          return NextResponse.json(ok({
            success: true,
            message: `Ticket ${updated.ticketNumber} updated to ${updated.status}`,
          }))
        }

        // ── Assign Maintenance Ticket ──────────────────────────────────
        case 'assign_maintenance_ticket': {
          await assertCan(ctx.userId, PERMISSIONS.MAINTENANCE_ASSIGN)
          const ticketId = String(payload.ticketId)
          const assigneeId = String(payload.assigneeId)

          let ticket = await prisma.maintenanceTicket.findUnique({ where: { id: ticketId }, select: { id: true } }).catch(() => null)
          if (!ticket) {
            ticket = await prisma.maintenanceTicket.findFirst({
              where: { ticketNumber: { equals: ticketId, mode: 'insensitive' } },
              select: { id: true },
            }).catch(() => null)
          }
          if (!ticket) return NextResponse.json(fail('NOT_FOUND', 'Ticket not found'), { status: 404 })

          const updated = await prisma.maintenanceTicket.update({
            where: { id: ticket.id },
            data: { assignedToId: assigneeId },
            select: { ticketNumber: true, assignedTo: { select: { name: true } } },
          })
          return NextResponse.json(ok({
            success: true,
            message: `Ticket ${updated.ticketNumber} assigned to ${updated.assignedTo?.name || 'user'}`,
          }))
        }

        default:
          return NextResponse.json(fail('VALIDATION_ERROR', `Unknown action: ${action}`), { status: 400 })
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request'), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/ai/assistant/confirm]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
