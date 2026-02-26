import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { createSupportTicket, listOrgSupportTickets } from '@/lib/services/platformSupportService'
import { PlatformTicketStatus } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const perPage = Math.min(50, parseInt(url.searchParams.get('perPage') || '20'))
    const status = url.searchParams.get('status') as PlatformTicketStatus | null

    const result = await listOrgSupportTickets(orgId, {
      status: status || undefined,
      page,
      perPage,
    })

    return NextResponse.json(ok(result))
  } catch (error) {
    console.error('[GET /api/support-tickets/platform]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const body = await req.json()
    const { subject, description, category, priority } = body

    if (!subject?.trim() || !description?.trim()) {
      return NextResponse.json(fail('BAD_REQUEST', 'subject and description are required'), { status: 400 })
    }

    const ticket = await createSupportTicket({
      organizationId: orgId,
      submittedByUserId: ctx.userId,
      subject: subject.trim(),
      description: description.trim(),
      category: category || undefined,
      priority: priority || undefined,
    })

    return NextResponse.json(ok(ticket), { status: 201 })
  } catch (error) {
    console.error('[POST /api/support-tickets/platform]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
