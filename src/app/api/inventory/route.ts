import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ok } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'

export async function GET(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  return await runWithOrgContext(orgId, async () => {
    const items = await prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(ok(items))
  })
}
