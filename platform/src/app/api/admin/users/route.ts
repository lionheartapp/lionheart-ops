import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'

export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, canSubmitEvents: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(users)
    })
  } catch {
    return NextResponse.json([])
  }
}
