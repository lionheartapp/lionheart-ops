/**
 * GET /api/forms/available-for-link — List forms not currently linked to any event
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const forms = await prisma.formDefinition.findMany({
        where: {
          eventProjectId: null,
          context: 'CUSTOM',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          description: true,
          context: true,
          createdAt: true,
        },
      })

      return NextResponse.json(ok(forms))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
