/**
 * Migration Script: Move approval rules from module-level to form-scoped
 *
 * For each existing ApprovalRule (where formDefinitionId IS NULL), this script
 * clones it onto the appropriate system form(s) based on module + conditions.
 *
 * After confirming clones work, it deactivates the original legacy rules.
 *
 * Usage:
 *   node scripts/migrate-approval-rules-to-forms.mjs [--dry-run] [--org=<orgId>]
 *
 * Options:
 *   --dry-run   Show what would be done without making changes
 *   --org=ID    Only migrate rules for a specific org (default: all orgs)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DRY_RUN = process.argv.includes('--dry-run')
const orgArg = process.argv.find(a => a.startsWith('--org='))
const TARGET_ORG = orgArg ? orgArg.split('=')[1] : null

// Mapping: module + condition → target system form systemKey(s)
function getTargetSystemKeys(rule) {
  if (rule.module === 'IT') {
    return ['it_request']
  }

  if (rule.module === 'MAINTENANCE') {
    // Maintenance rules apply to the facilities_request form
    // Category-specific rules still map here (category is a condition, not a form selector)
    return ['facilities_request']
  }

  // EVENT module
  if (rule.eventCategory) {
    const cat = rule.eventCategory.toLowerCase()
    if (cat.includes('facilit')) return ['facilities_request']
    if (cat.includes('it') || cat.includes('tech')) return ['it_request']
  }

  // Default event rules → all event creation forms
  if (rule.isDefault) {
    return ['single_event', 'recurring_event', 'multiday_event']
  }

  // Specific event rules → single_event (most common)
  return ['single_event']
}

async function migrateOrg(orgId) {
  console.log(`\n── Org: ${orgId} ──`)

  // Get legacy rules (no formDefinitionId)
  const legacyRules = await prisma.approvalRule.findMany({
    where: { organizationId: orgId, formDefinitionId: null, isActive: true },
    include: {
      steps: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (legacyRules.length === 0) {
    console.log('  No legacy rules to migrate.')
    return { migrated: 0, skipped: 0 }
  }

  console.log(`  Found ${legacyRules.length} legacy rule(s)`)

  // Get available system forms for this org
  const forms = await prisma.formDefinition.findMany({
    where: { organizationId: orgId, systemKey: { not: null } },
    select: { id: true, systemKey: true },
  })

  const formByKey = Object.fromEntries(forms.map(f => [f.systemKey, f.id]))

  let migrated = 0
  let skipped = 0

  for (const rule of legacyRules) {
    const targetKeys = getTargetSystemKeys(rule)

    for (const key of targetKeys) {
      const formId = formByKey[key]
      if (!formId) {
        console.log(`  SKIP: No form with systemKey="${key}" found for rule "${rule.name}"`)
        skipped++
        continue
      }

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would clone "${rule.name}" → form ${key} (${formId})`)
        console.log(`            Steps: ${rule.steps.length}`)
        migrated++
        continue
      }

      // Clone the rule with formDefinitionId set
      const clonedRule = await prisma.approvalRule.create({
        data: {
          organizationId: orgId,
          formDefinitionId: formId,
          module: rule.module,
          name: rule.name,
          description: rule.description,
          schoolId: rule.schoolId,
          campusId: rule.campusId,
          eventCategory: rule.eventCategory,
          minAttendance: rule.minAttendance,
          requiresResource: rule.requiresResource,
          isOffCampus: rule.isOffCampus,
          maintenanceCategory: rule.maintenanceCategory,
          maintenancePriority: rule.maintenancePriority,
          maintenanceBuildingId: rule.maintenanceBuildingId,
          maintenanceMinCost: rule.maintenanceMinCost,
          isDefault: rule.isDefault,
          isFinalApprover: rule.isFinalApprover,
          executionMode: rule.executionMode,
          sortOrder: rule.sortOrder,
          isActive: true,
        },
      })

      // Clone steps
      for (const step of rule.steps) {
        await prisma.approvalFlowEntry.create({
          data: {
            organizationId: orgId,
            ruleId: clonedRule.id,
            teamId: step.teamId,
            mode: step.mode,
            trigger: step.trigger,
            resourceType: step.resourceType,
            escalationHours: step.escalationHours,
            escalationAction: step.escalationAction,
            escalateToUserId: step.escalateToUserId,
            autoSkipIfNotNeeded: step.autoSkipIfNotNeeded,
            sortOrder: step.sortOrder,
            assignedUserId: step.assignedUserId,
          },
        })
      }

      console.log(`  CLONED: "${rule.name}" → ${key} (${rule.steps.length} steps)`)
      migrated++
    }

    // Deactivate original legacy rule
    if (!DRY_RUN) {
      await prisma.approvalRule.update({
        where: { id: rule.id },
        data: { isActive: false },
      })
      console.log(`  DEACTIVATED: original rule "${rule.name}" (${rule.id})`)
    }
  }

  return { migrated, skipped }
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log(' Migrate Approval Rules → Form-Scoped Workflows')
  console.log('═══════════════════════════════════════════════════')
  if (DRY_RUN) console.log(' MODE: DRY RUN (no changes)')

  let orgs
  if (TARGET_ORG) {
    orgs = [{ id: TARGET_ORG }]
  } else {
    orgs = await prisma.organization.findMany({ select: { id: true } })
  }

  console.log(`Processing ${orgs.length} org(s)...`)

  let totalMigrated = 0
  let totalSkipped = 0

  for (const org of orgs) {
    const { migrated, skipped } = await migrateOrg(org.id)
    totalMigrated += migrated
    totalSkipped += skipped
  }

  console.log('\n═══════════════════════════════════════════════════')
  console.log(` Done. Migrated: ${totalMigrated} | Skipped: ${totalSkipped}`)
  console.log('═══════════════════════════════════════════════════')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
