import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'

export async function POST(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const body = (await req.json()) as { title?: string; description?: string }

  return await runWithOrgContext(orgId, async () => {
    const draft = await prisma.draftEvent.create({
      data: {
        title: body.title || '',
        description: body.description || '',
        status: 'DRAFT',
      } as any,
    })
    return NextResponse.json(ok(draft), { status: 201 })
  })
}

export async function GET(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)

  return await runWithOrgContext(orgId, async () => {
    const drafts = await prisma.draftEvent.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
    })
    return NextResponse.json(ok(drafts))
  })
}

export async function DELETE() {
  return NextResponse.json(fail('METHOD_NOT_ALLOWED', 'Use /api/draft-events/[id] for item-level operations'), { status: 405 })
}