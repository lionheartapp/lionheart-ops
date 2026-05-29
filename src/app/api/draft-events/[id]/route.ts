import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as draftEventService from '@/lib/services/draftEventService'
import { PERMISSIONS } from '@/lib/permissions'

export const GET = withAuth(async ({ ctx, params }) => {
  const draft = await draftEventService.getDraftEventById(params.id, ctx.userId)
  if (!draft) {
    return NextResponse.json(fail('NOT_FOUND', 'Draft event not found'), { status: 404 })
  }
  return NextResponse.json(ok(draft))
}, { permission: PERMISSIONS.EVENTS_CREATE })

export const PUT = withAuth(async ({ req, ctx, params }) => {
  const body = await req.json()
  const draft = await draftEventService.updateDraftEvent(params.id, body, ctx.userId)
  return NextResponse.json(ok(draft))
}, { permission: PERMISSIONS.EVENTS_CREATE })

export const DELETE = withAuth(async ({ ctx, params }) => {
  await draftEventService.deleteDraftEvent(params.id, ctx.userId)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENTS_CREATE })
