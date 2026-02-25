import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { operationsEngine } from '@/lib/services/operations/engine'

export async function GET(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  return await runWithOrgContext(orgId, async () => {
    const events = await prisma.event.findMany({ orderBy: { startsAt: 'desc' }, take: 50 })
    return NextResponse.json(ok(events))
  })
}

export async function POST(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const body = (await req.json()) as { title?: string; room?: string; startsAt?: string; endsAt?: string }

  if (!body.title || !body.startsAt || !body.endsAt) {
    return NextResponse.json(fail('BAD_REQUEST', 'title, startsAt, endsAt required'), { status: 400 })
  }

  return await runWithOrgContext(orgId, async () => {
    const event = await prisma.event.create({
      data: {
        title: body.title!,
        room: body.room || null,
        startsAt: new Date(body.startsAt!),
        endsAt: new Date(body.endsAt!),
      } as any,
    })

    await operationsEngine.onEventCreated(event)

    return NextResponse.json(ok(event), { status: 201 })
  })
}
