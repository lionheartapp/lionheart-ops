import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as ticketService from '@/lib/services/ticketService'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
      const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
      const status = searchParams.get('status') || undefined
      const category = searchParams.get('category') || undefined
      const priority = searchParams.get('priority') || undefined
      const assignedToId = searchParams.get('assignedToId') || undefined
      const schoolId = searchParams.get('schoolId') || undefined

      const tickets = await ticketService.listTickets(
        { limit, offset, status: status as any, category: category as any, priority: priority as any, assignedToId, schoolId },
        userContext.userId
      )

      return NextResponse.json(ok(tickets))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const ticket = await ticketService.createTicket(
        body,
        userContext.userId
      )

      return NextResponse.json(ok(ticket), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}
