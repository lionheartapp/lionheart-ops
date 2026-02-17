import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'
import { requireActivePlan, PlanRestrictedError } from '@/lib/planCheck'
import { logAction } from '@/lib/audit'

type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED'

function toFrontendStatus(s: string): string {
  if (s === 'IN_PROGRESS') return 'in-progress'
  if (s === 'RESOLVED') return 'resolved'
  return 'new'
}

function toFrontendPriority(p: string): string {
  return (p || 'NORMAL').toLowerCase()
}

function formatTicket(t: {
  id: string
  title: string
  description: string | null
  category: string
  status: TicketStatus
  priority: string
  createdAt: Date
  submittedBy: { name: string | null } | null
  assignedTo: { name: string | null } | null
}) {
  const now = Date.now()
  const created = new Date(t.createdAt).getTime()
  const diffMs = now - created
  let timeStr = 'Just now'
  if (diffMs > 60000) timeStr = `${Math.floor(diffMs / 60000)} min ago`
  if (diffMs > 3600000) timeStr = `${Math.floor(diffMs / 3600000)} hrs ago`
  if (diffMs > 86400000) timeStr = `${Math.floor(diffMs / 86400000)} days ago`

  const type = t.category === 'IT' ? 'IT' : 'Facilities'
  return {
    id: t.id,
    type,
    title: t.title,
    description: t.description,
    priority: toFrontendPriority(t.priority),
    time: timeStr,
    submittedBy: t.submittedBy?.name ?? 'Unknown',
    status: toFrontendStatus(t.status),
    assignedTo: t.assignedTo?.name ?? null,
    createdAt: t.createdAt.toISOString(),
    order: created,
  }
}

/** PATCH /api/tickets/[ticketId] — Update ticket status or assignee */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params
    if (!ticketId) {
      return NextResponse.json({ error: 'Missing ticket ID' }, { status: 400, headers: corsHeaders })
    }

    return await withOrg(req, prismaBase, async () => {
      await requireActivePlan(prismaBase, getOrgId()!)
      const body = (await req.json()) as {
        status?: string
        assignedToId?: string | null
      }

      const updates: { status?: TicketStatus; assignedToId?: string | null } = {}
      if (body.status != null) {
        const s = (body.status || '').toUpperCase().replace(/[- ]/g, '_')
        if (['NEW', 'IN_PROGRESS', 'RESOLVED'].includes(s)) {
          updates.status = s as TicketStatus
        }
      }
      if ('assignedToId' in body) {
        updates.assignedToId = body.assignedToId || null
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid updates' }, { status: 400, headers: corsHeaders })
      }

      const ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: updates,
        include: {
          submittedBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
      })

      await logAction({
        action: 'UPDATE',
        entityType: 'Ticket',
        entityId: ticketId,
        metadata: updates,
      })

      return NextResponse.json(formatTicket(ticket), { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof PlanRestrictedError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 402, headers: corsHeaders }
      )
    }
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('PATCH /api/tickets/[ticketId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update ticket' },
      { status: 500, headers: corsHeaders }
    )
  }
}
