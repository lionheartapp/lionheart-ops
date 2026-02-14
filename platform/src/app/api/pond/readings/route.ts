import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId, requireModule } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

/** Latest N pond readings for dashboard. Requires waterManagement module. */
export async function GET(req: NextRequest) {
  const u = new URL(req.url)
  const limit = Math.min(parseInt(u.searchParams.get('limit') || '10', 10), 50)
  try {
    return await withOrg(req, prismaBase, async () => {
      await requireModule(prismaBase, getOrgId(), 'waterManagement')
      const logs = await prisma.pondLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(logs, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'MODULE_NOT_ACTIVE') {
      return NextResponse.json({ error: 'Water Management module is not active for your plan' }, { status: 403, headers: corsHeaders })
    }
    return NextResponse.json([], { headers: corsHeaders })
  }
}
