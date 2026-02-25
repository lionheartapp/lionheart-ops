import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.ROLES_READ)
  const list = await rawPrisma.permission.findMany({
    orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    select: {
      id: true,
      resource: true,
      action: true,
      scope: true,
      description: true,
      createdAt: true,
    },
  })
  return NextResponse.json(ok(list))
}
