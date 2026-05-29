/**
 * @authOnly Returns the signed-in user's checklist; org setup items are included only for workspace managers.
 *
 * GET /api/onboarding/checklist
 *
 * Returns the derived first-time-user onboarding checklist for the
 * calling user's organization. Includes two sections:
 *
 *   • org   — workspace-level tasks (only populated if the user can
 *             manage workspace, otherwise empty)
 *   • user  — personal profile tasks (always populated)
 *
 * Both sections derive their state from the database on every request —
 * see src/lib/services/onboardingChecklistService.ts for the contract.
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import {
  getOrgChecklist,
  getUserChecklist,
  type ChecklistResponse,
} from '@/lib/services/onboardingChecklistService'
import { can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const EMPTY: ChecklistResponse = {
  items: [],
  essentialComplete: true,
  totalCount: 0,
  completedCount: 0,
  requiredCount: 0,
  requiredCompleted: 0,
  widgetDismissed: false,
}

export const GET = withAuth(async ({ orgId, ctx }) => {
  // Only admins see the org-level checklist. The workspace management
  // permission is the same gate used by /api/auth/permissions.
  const canManageWorkspace = await can(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)

  const [org, user] = await Promise.all([
    canManageWorkspace ? getOrgChecklist(orgId) : Promise.resolve(EMPTY),
    getUserChecklist(ctx.userId),
  ])

  return NextResponse.json(
    ok({
      org,
      user,
      canManageWorkspace,
    })
  )
})
