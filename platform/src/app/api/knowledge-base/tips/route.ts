import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { corsHeaders } from '@/lib/cors'

export async function POST(req: Request) {
  try {
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
  } catch (err) {
    console.error('Create tip error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Create failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
