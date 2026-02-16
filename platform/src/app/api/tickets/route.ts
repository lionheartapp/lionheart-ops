import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'
import { requireActivePlan, PlanRestrictedError } from '@/lib/planCheck'
import { logAction } from '@/lib/audit'

type TicketCategory = 'MAINTENANCE' | 'IT' | 'EVENT'
type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'

/** Map frontend type to DB category */
function toCategory(type: string): TicketCategory {
  const t = (type || '').toUpperCase()
  if (t === 'IT') return 'IT'
  if (t === 'FACILITIES' || t === 'AV') return 'MAINTENANCE'
  return 'MAINTENANCE'
}

/** Map frontend priority to DB */
function toPriority(p: string): TicketPriority {
  const lower = (p || 'normal').toLowerCase()
  if (lower === 'critical') return 'CRITICAL'
  if (lower === 'high') return 'HIGH'
  if (lower === 'low') return 'LOW'
  return 'NORMAL'
}

/** Map DB status to frontend */
function toFrontendStatus(s: string): string {
  if (s === 'IN_PROGRESS') return 'in-progress'
  if (s === 'RESOLVED') return 'resolved'
  return 'new'
}

/** Map DB priority to frontend */
function toFrontendPriority(p: string): string {
  return (p || 'NORMAL').toLowerCase()
}

/** Format ticket for frontend consumption */
function formatTicket(t: {
  id: string
  title: string
  description: string | null
  category: TicketCategory
  status: TicketStatus
  priority: TicketPriority
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

/** GET /api/tickets — Fetch all tickets for the current organization */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const tickets = await prisma.ticket.findMany({
        include: {
          submittedBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      const formatted = tickets.map(formatTicket)
      return NextResponse.json(formatted, { headers: corsHeaders })
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('GET /api/tickets error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch tickets' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/** POST /api/tickets — Create a new ticket */
export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      await requireActivePlan(prismaBase, getOrgId()!)
      const body = (await req.json()) as {
        title: string
        description?: string
        category?: string
        type?: string
        priority?: string
        roomId?: string
      }

      const { title } = body
      if (!title?.trim()) {
        return NextResponse.json(
          { error: 'Missing title' },
          { status: 400, headers: corsHeaders }
        )
      }

      const category = toCategory(body.category || body.type || 'MAINTENANCE')
      const priority = toPriority(body.priority || 'normal')

      let submittedById: string | undefined
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyToken(authHeader.slice(7))
        if (payload?.userId) submittedById = payload.userId
      }

      const ticket = await prisma.ticket.create({
        data: {
          title: title.trim(),
          description: body.description?.trim() || null,
          category,
          priority,
          roomId: body.roomId || null,
          submittedById: submittedById || null,
        },
        include: {
          submittedBy: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
      })

      await logAction({
        action: 'CREATE',
        entityType: 'Ticket',
        entityId: ticket.id,
        userId: submittedById,
        metadata: { title: ticket.title },
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
    console.error('POST /api/tickets error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create ticket' },
      { status: 500, headers: corsHeaders }
    )
  }
}
