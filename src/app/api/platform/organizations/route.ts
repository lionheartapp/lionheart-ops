import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line no-restricted-imports -- Platform organization list operates across tenant orgs after platform permission checks.
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { logger } from '@/lib/logger'

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

    // `institutionType`, `gradeLevel`, `principalName`, `principalEmail` moved
    // off Organization in Phase 1c ontology inversion — they're now on School.
    // We flatten the primary (first-sorted) School's values back onto the
    // response for platform admin UI backward-compat.
    const [organizations, total] = await Promise.all([
      rawPrisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          onboardingStatus: true,
          stripeCustomerId: true,
          phone: true,
          createdAt: true,
          schools: {
            where: { deletedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            take: 1,
            select: {
              institutionType: true,
              principalName: true,
              principalEmail: true,
            },
          },
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

    // Flatten primary-school principal + institutionType onto each org so the
    // existing admin UI contract (`org.principalName`, etc.) keeps working.
    const organizationsWithCompat = organizations.map((org) => {
      const primarySchool = org.schools[0]
      return {
        ...org,
        institutionType: primarySchool?.institutionType ?? null,
        gradeLevel: null,
        principalName: primarySchool?.principalName ?? null,
        principalEmail: primarySchool?.principalEmail ?? null,
      }
    })

    return NextResponse.json(ok({ organizations: organizationsWithCompat, total, page, perPage }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to list organizations')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
