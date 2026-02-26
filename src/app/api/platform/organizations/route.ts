import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'

export async function GET(req: NextRequest) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('perPage') || '25')))
    const search = url.searchParams.get('search')?.trim()
    const status = url.searchParams.get('status') as string | null

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status) where.onboardingStatus = status

    const [organizations, total] = await Promise.all([
      rawPrisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          institutionType: true,
          gradeLevel: true,
          onboardingStatus: true,
          stripeCustomerId: true,
          principalName: true,
          principalEmail: true,
          phone: true,
          createdAt: true,
          _count: {
            select: {
              users: { where: { deletedAt: null } },
              subscriptions: true,
            },
          },
          subscriptions: {
            where: { status: { in: ['TRIALING', 'ACTIVE'] } },
            include: { plan: { select: { name: true, slug: true } } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      rawPrisma.organization.count({ where }),
    ])

    return NextResponse.json(ok({ organizations, total, page, perPage }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/platform/organizations]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
