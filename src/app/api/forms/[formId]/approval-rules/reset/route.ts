/**
 * POST /api/forms/[formId]/approval-rules/reset
 * Reset approval workflows on a system form back to the platform defaults.
 * Only works on system forms (isDefault: true).
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
// eslint-disable-next-line no-restricted-imports -- Approval reset manually scopes all destructive workflow deletes to orgId/formId after verifying system form ownership.
import { rawPrisma } from '@/lib/db'
import { seedFormApprovalDefaults } from '@/lib/services/formService'
import { getFormApprovalRules } from '@/lib/services/approvalRuleService'

export const POST = withAuth(
  async ({ orgId, params }) => {
    const { formId } = await params

    // Only allow reset on system forms
    const form = await rawPrisma.formDefinition.findFirst({
      where: { id: formId, organizationId: orgId, isDefault: true },
      select: { id: true, systemKey: true },
    })

    if (!form || !form.systemKey) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'Reset is only available for system forms'),
        { status: 400 }
      )
    }

    // Delete all existing approval rules and their steps for this form
    const existingRules = await rawPrisma.approvalRule.findMany({
      where: { organizationId: orgId, formDefinitionId: formId },
      select: { id: true },
    })

    if (existingRules.length > 0) {
      const ruleIds = existingRules.map((r) => r.id)

      // Delete flow entries first (child records)
      await rawPrisma.approvalFlowEntry.deleteMany({
        where: { ruleId: { in: ruleIds } },
      })

      // Delete the rules
      await rawPrisma.approvalRule.deleteMany({
        where: { id: { in: ruleIds } },
      })
    }

    // Re-seed defaults for this org (only seeds forms missing rules)
    await seedFormApprovalDefaults(orgId)

    // Return the freshly seeded rules
    const rules = await getFormApprovalRules(formId)
    return NextResponse.json(ok(rules))
  },
  { permission: PERMISSIONS.SETTINGS_UPDATE }
)
