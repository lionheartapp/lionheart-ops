import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)
    const { id } = await params

    const users = await rawPrisma.user.findMany({
      where: { organizationId: id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        status: true,
        jobTitle: true,
        createdAt: true,
        userRole: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(ok(users))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/platform/organizations/[id]/users]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
