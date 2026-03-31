import { NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as draftEventService from '@/lib/services/draftEventService'
import { parsePagination, paginationMeta } from '@/lib/pagination'

export const GET = withAuth(async ({ ctx, searchParams }) => {
  const { page, limit, skip } = parsePagination(searchParams)
  const status = searchParams.get('status') || undefined

  const filters = { limit, skip, status: status as any }

  const [total, drafts] = await Promise.all([
    draftEventService.countDraftEvents(filters, ctx.userId),
    draftEventService.listDraftEvents(filters, ctx.userId),
  ])

  return NextResponse.json(ok(drafts, paginationMeta(total, { page, limit, skip })))
})

export const POST = withAuth(async ({ req, ctx }) => {
  const body = await req.json()
  const draft = await draftEventService.createDraftEvent(body, ctx.userId)
  return NextResponse.json(ok(draft), { status: 201 })
})

export async function DELETE() {
  return NextResponse.json(fail('METHOD_NOT_ALLOWED', 'Use /api/draft-events/[id] for item-level operations'), { status: 405 })
}
