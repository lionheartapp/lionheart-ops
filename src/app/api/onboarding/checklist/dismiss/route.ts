/**
 * @authOnly Lets users dismiss their own checklist items; org checklist dismissal requires workspace management permission.
 *
 * POST /api/onboarding/checklist/dismiss
 *
 * Dismiss a single checklist item or the whole dashboard widget.
 *
 * Body:
 *   • { scope: 'org', itemId: string }   — dismiss an org-level item (admins only)
 *   • { scope: 'user', itemId: string }  — dismiss a user-level item (self)
 *   • { scope: 'widget' }                — dismiss the dashboard widget (admins only,
 *                                          only allowed once essentials are complete)
 *
 * Non-dismissable items (essentials) are rejected with 400. Widget dismissal
 * before essentials are done is rejected with 400.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import {
  dismissOrgItem,
  dismissUserItem,
  dismissOrgWidget,
  getOrgChecklist,
} from '@/lib/services/onboardingChecklistService'
import { can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const dismissSchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('org'),
    itemId: z.string().min(1),
  }),
  z.object({
    scope: z.literal('user'),
    itemId: z.string().min(1),
  }),
  z.object({
    scope: z.literal('widget'),
  }),
])

export const POST = withAuth<z.infer<typeof dismissSchema>>(
  async ({ orgId, ctx, body }) => {
    if (body.scope === 'user') {
      await dismissUserItem(ctx.userId, body.itemId)
      return NextResponse.json(ok({ dismissed: body.itemId, scope: 'user' }))
    }

    // Both 'org' and 'widget' scopes need workspace management perms.
    const canManageWorkspace = await can(ctx.userId, PERMISSIONS.SETTINGS_UPDATE)
    if (!canManageWorkspace) {
      return NextResponse.json(
        fail('FORBIDDEN', 'You do not have permission to modify workspace settings'),
        { status: 403 }
      )
    }

    if (body.scope === 'widget') {
      // Allow widget dismissal once essentials are done OR the user is
      // 80%+ complete — matches the client-side canDismissWidget logic.
      const checklist = await getOrgChecklist(orgId)
      const progressPct =
        checklist.totalCount > 0
          ? (checklist.completedCount / checklist.totalCount) * 100
          : 0
      if (!checklist.essentialComplete && progressPct < 80) {
        return NextResponse.json(
          fail(
            'BAD_REQUEST',
            'Finish the required setup tasks before dismissing the checklist.'
          ),
          { status: 400 }
        )
      }
      await dismissOrgWidget(orgId)
      return NextResponse.json(ok({ dismissed: 'widget', scope: 'widget' }))
    }

    // scope === 'org'
    // Verify the item exists on the current checklist and is dismissable.
    const checklist = await getOrgChecklist(orgId)
    const item = checklist.items.find((i) => i.id === body.itemId)
    if (!item) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Checklist item not found'),
        { status: 404 }
      )
    }
    if (!item.dismissable) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'This task is required and cannot be dismissed'),
        { status: 400 }
      )
    }

    await dismissOrgItem(orgId, body.itemId)
    return NextResponse.json(ok({ dismissed: body.itemId, scope: 'org' }))
  },
  { schema: dismissSchema }
)
