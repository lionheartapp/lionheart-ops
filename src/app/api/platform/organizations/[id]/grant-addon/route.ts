import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
// eslint-disable-next-line no-restricted-imports -- Platform addon grant route intentionally manages tenant modules across organizations after platform permission checks.
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getPlatformContext } from '@/lib/auth/platform-context'
import { assertPlatformAdminCan, PLATFORM_PERMISSIONS } from '@/lib/auth/platform-permissions'
import { platformAudit, getPlatformIp } from '@/lib/services/platformAuditService'
import { logger } from '@/lib/logger'

const GrantAddonSchema = z.object({
  moduleId: z.string().min(1),
  /** 'free' = 100% off, 'discount' = percentage off */
  type: z.enum(['free', 'discount']),
  /** Discount percentage (1-100). Ignored when type='free'. */
  discountPercent: z.number().int().min(1).max(100).optional(),
  /** Duration in months */
  months: z.number().int().min(1).max(60),
  /** Internal note */
  note: z.string().max(500).optional(),
})

/**
 * POST /api/platform/organizations/[id]/grant-addon
 *
 * Grants a school free or discounted access to a specific add-on module
 * for all their campuses for a specified number of months.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getPlatformContext(req)
    assertPlatformAdminCan(ctx.role, PLATFORM_PERMISSIONS.ORGANIZATIONS_UPDATE)
    const { id } = await params

    const body = await req.json()
    const validation = GrantAddonSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', validation.error.issues), { status: 400 })
    }

    const { moduleId, type, discountPercent, months, note } = validation.data
    const effectiveDiscount = type === 'free' ? 100 : (discountPercent ?? 0)

    // Verify org exists
    const org = await rawPrisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    })
    if (!org) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    // Get all campuses for this org
    const campuses = await rawPrisma.campus.findMany({
      where: { organizationId: id },
      select: { id: true, name: true },
    })

    const now = new Date()
    const endsAt = new Date(now)
    endsAt.setMonth(endsAt.getMonth() + months)

    const tierLabel = type === 'free' ? 'platform-granted-free' : `platform-granted-${effectiveDiscount}off`

    // Enable the module for all campuses (or org-level if no campuses)
    const enabledFor: string[] = []
    if (campuses.length > 0) {
      for (const campus of campuses) {
        await rawPrisma.tenantModule.upsert({
          where: {
            organizationId_moduleId_campusId: {
              organizationId: id,
              moduleId,
              campusId: campus.id,
            },
          },
          create: {
            organizationId: id,
            moduleId,
            campusId: campus.id,
            planTier: tierLabel,
          },
          update: {
            planTier: tierLabel,
            enabledAt: now,
          },
        })
        enabledFor.push(campus.name)
      }
    } else {
      // No campuses — enable at org level
      await rawPrisma.tenantModule.upsert({
        where: {
          organizationId_moduleId_campusId: {
            organizationId: id,
            moduleId,
            campusId: '',
          },
        },
        create: {
          organizationId: id,
          moduleId,
          campusId: null,
          planTier: tierLabel,
        },
        update: {
          planTier: tierLabel,
          enabledAt: now,
        },
      })
      enabledFor.push('(org-level)')
    }

    const label = type === 'free'
      ? `Free ${moduleId} for ${months} month${months > 1 ? 's' : ''}`
      : `${effectiveDiscount}% off ${moduleId} for ${months} month${months > 1 ? 's' : ''}`

    platformAudit({
      platformAdminId: ctx.adminId,
      action: 'organization.grant-addon',
      resourceType: 'Organization',
      resourceId: id,
      details: {
        moduleId,
        type,
        discountPercent: effectiveDiscount,
        months,
        note: note || null,
        startsAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        enabledFor,
      },
      ipAddress: getPlatformIp(req),
    })

    return NextResponse.json(ok({
      moduleId,
      label,
      endsAt,
      campusesEnabled: enabledFor.length,
    }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient platform permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'Insufficient permissions'), { status: 403 })
    }
    logger.error({ error: String(error) }, 'Failed to grant addon')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
