import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
    const body = (await req.json()) as { content: string; sourceTicketId?: string }
    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'Missing content' }, { status: 400, headers: corsHeaders })
    }
    const tip = await prisma.maintenanceTip.create({
      data: {
        content: body.content.trim(),
        sourceTicketId: body.sourceTicketId,
      },
    })
    return NextResponse.json(tip, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('Create tip error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Create failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
