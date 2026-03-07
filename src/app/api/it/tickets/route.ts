/**
 * GET /api/it/tickets — list IT tickets (role-scoped)
 * POST /api/it/tickets — create a new IT ticket
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createITTicket,
  listITTickets,
  CreateITTicketSchema,
} from '@/lib/services/itTicketService'
import type { ITTicketStatus, ITIssueType, ITPriority } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_SUBMIT)

    const body = await req.json()
    const validated = CreateITTicketSchema.parse(body)

    const ticket = await runWithOrgContext(orgId, () =>
      createITTicket(validated, ctx.userId, orgId)
    )

    return NextResponse.json(ok(ticket), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[POST /api/it/tickets]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_TICKET_READ_OWN)

    const url = new URL(req.url)
    const filters = {
      status: (url.searchParams.get('status') || undefined) as ITTicketStatus | undefined,
      issueType: (url.searchParams.get('issueType') || undefined) as ITIssueType | undefined,
      priority: (url.searchParams.get('priority') || undefined) as ITPriority | undefined,
      schoolId: url.searchParams.get('schoolId') || undefined,
      assignedToId: url.searchParams.get('assignedToId') || undefined,
      search: url.searchParams.get('search') || undefined,
      unassigned: url.searchParams.get('unassigned') === 'true',
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
      offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined,
    }

    const result = await runWithOrgContext(orgId, () =>
      listITTickets(filters, { userId: ctx.userId, orgId })
    )

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/tickets]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
