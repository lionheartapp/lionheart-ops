import { NextRequest, NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as draftEventService from '@/lib/services/draftEventService'
import { z } from 'zod'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const draft = await draftEventService.createDraftEvent(
        body,
        userContext.userId
      )
      return NextResponse.json(ok(draft), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
      const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
      const status = searchParams.get('status') || undefined

      const drafts = await draftEventService.listDraftEvents(
        { limit, offset, status: status as any },
        userContext.userId
      )

      return NextResponse.json(ok(drafts))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 }
    )
  }
}

export async function DELETE() {
  return NextResponse.json(fail('METHOD_NOT_ALLOWED', 'Use /api/draft-events/[id] for item-level operations'), { status: 405 })
}