/**
 * DELETE /api/it/erate/entities/[ben]
 *
 * Removes a Billed Entity Number from the organization and tears down ALL
 * associated synced USAC data (funding years, Form 470/471 applications,
 * FRNs, disbursements, sync-run history scoped to that BEN).
 *
 * Why a hard delete? Most callers hit this because they typed the wrong BEN
 * during onboarding — they want a clean slate so they can re-enter and
 * re-sync. The associated data is mirrored from a public USAC source, so
 * losing the local copy is harmless (a sync brings it right back).
 *
 * If the deleted entity was the primary BEN and another entity exists, the
 * oldest remaining entity is promoted to primary.
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { rawPrisma, type PrismaDelegate } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

interface DeleteParams extends Record<string, string> {
  ben: string
}


const BEN_REGEX = /^\d{1,12}$/

export const DELETE = withAuth<unknown, DeleteParams>(
  async ({ orgId, params }) => {
    const ben = params.ben?.trim()

    if (!ben || !BEN_REGEX.test(ben)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'BEN must be a numeric Billed Entity Number'),
        { status: 400 }
      )
    }

    const entityDelegate = rawPrisma.iTERateEntity as unknown as PrismaDelegate
    const fundingYearDelegate = rawPrisma.iTERateFundingYear as unknown as PrismaDelegate
    const form470Delegate = rawPrisma.iTERateForm470 as unknown as PrismaDelegate
    const form471Delegate = rawPrisma.iTERateForm471 as unknown as PrismaDelegate
    const frnDelegate = rawPrisma.iTERateFRN as unknown as PrismaDelegate
    const disbursementDelegate = rawPrisma.iTERateDisbursement as unknown as PrismaDelegate
    const syncRunDelegate = rawPrisma.iTERateSyncRun as unknown as PrismaDelegate

    const existing = await entityDelegate.findUnique({
      where: { organizationId_ben: { organizationId: orgId, ben } },
      select: { id: true, isPrimary: true },
    })

    if (!existing) {
      return NextResponse.json(fail('NOT_FOUND', `BEN ${ben} is not on file for this organization`), {
        status: 404,
      })
    }

    // Delete all data scoped to this BEN. Children that reference the entity
    // by FK (Form 470 / 471 .applicantEntityId) cascade to SetNull thanks to
    // the schema, but the rows themselves are keyed by `ben` string so we
    // need explicit deletes. Order matters: leaves first, then parents.
    // Delete in dependency order: leaves first, then parents
    await disbursementDelegate.deleteMany({ where: { organizationId: orgId, ben } })
    await frnDelegate.deleteMany({ where: { organizationId: orgId, ben } })
    await form471Delegate.deleteMany({ where: { organizationId: orgId, ben } })
    await form470Delegate.deleteMany({ where: { organizationId: orgId, ben } })
    await fundingYearDelegate.deleteMany({ where: { organizationId: orgId, ben } })
    await syncRunDelegate.deleteMany({ where: { organizationId: orgId, ben } })
    await entityDelegate.delete({
      where: { organizationId_ben: { organizationId: orgId, ben } },
    })

    // If we just removed the primary BEN, promote another entity (if any).
    let promotedBen: string | null = null
    if (existing.isPrimary) {
      const next = await entityDelegate.findFirst({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, ben: true },
      })
      if (next) {
        await entityDelegate.update({
          where: { id: next.id },
          data: { isPrimary: true },
        })
        promotedBen = next.ben
      }
    }

    const summary = {
      ben,
      deleted: true,
      promotedNewPrimary: promotedBen,
    }

    return NextResponse.json(ok(summary))
  },
  { permission: PERMISSIONS.IT_ERATE_MANAGE }
)
