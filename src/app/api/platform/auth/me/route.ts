import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line no-restricted-imports -- Platform auth/me reads platform admin records outside tenant org scoping after platform token verification.
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { logger } from '@/lib/logger'

// @authOnly Platform admin profile route is available to any valid platform admin token.
export async function GET(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)

    const admin = await rawPrisma.platformAdmin.findUnique({
      where: { id: ctx.adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })

    if (!admin) {
      return NextResponse.json(fail('NOT_FOUND', 'Admin not found'), { status: 404 })
    }

    return NextResponse.json(ok(admin))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing platform admin context')) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }
    logger.error({ error: String(error) }, 'Failed to get admin')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
