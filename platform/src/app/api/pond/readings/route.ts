import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

/** Latest N pond readings for dashboard */
export async function GET(req: NextRequest) {
  const u = new URL(req.url)
  const limit = Math.min(parseInt(u.searchParams.get('limit') || '10', 10), 50)
  try {
    return await withOrg(req, prismaBase, async () => {
    const logs = await prisma.pondLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(logs, { headers: corsHeaders })
    })
  } catch {
    return NextResponse.json([], { headers: corsHeaders })
  }
}
