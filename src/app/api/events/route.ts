import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import * as eventService from '@/lib/services/eventService'
import { operationsEngine } from '@/lib/services/operations/engine'
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

      const events = await eventService.listEvents(
        { limit, offset, status: status as any },
        userContext.userId
      )

      return NextResponse.json(ok(events))
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

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const event = await eventService.createEvent(
        body,
        userContext.userId
      )

      // Trigger operations automation
      await operationsEngine.onEventCreated(event)

      return NextResponse.json(ok(event), { status: 201 })
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
