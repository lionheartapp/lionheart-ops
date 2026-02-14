import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { corsHeaders } from '@/lib/cors'

/** Latest N pond readings for dashboard */
export async function GET(req: Request) {
  const u = new URL(req.url)
  const limit = Math.min(parseInt(u.searchParams.get('limit') || '10', 10), 50)
  try {
    const logs = await prisma.pondLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(logs, { headers: corsHeaders })
  } catch {
    return NextResponse.json([], { headers: corsHeaders })
  }
}
