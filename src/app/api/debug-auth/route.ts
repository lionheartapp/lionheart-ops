import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'

export async function GET(req: NextRequest) {
  const orgId = 'cmly7nsqt0000cdtmpyswsrlj'
  const email = 'mkerley@linfield.com'

  try {
    // Test 1: Direct query without org context
    const directUser = await prisma.$extends({}).user.findFirst({
      where: { organizationId: orgId, email }
    })

    // Test 2: Same but with org context
    const contextUser = await runWithOrgContext(orgId, async () => {
      return await prisma.user.findFirst({ where: { email } })
    })

    return NextResponse.json({
      directUser: directUser ? { id: directUser.id, email: directUser.email } : null,
      contextUser: contextUser ? { id: contextUser.id, email: contextUser.email } : null,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
