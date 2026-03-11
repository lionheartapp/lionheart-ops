#!/usr/bin/env node
/**
 * backfill-billing-permission.mjs
 * Adds the `settings:billing` permission to all existing admin roles.
 *
 * Background: DEFAULT_ROLES.ADMIN was missing PERMISSIONS.SETTINGS_BILLING.
 * New orgs created after Phase 16 will automatically get this permission via
 * seedOrgDefaults. This script backfills existing orgs.
 *
 * Idempotent: safe to run multiple times — P2002 (duplicate RolePermission)
 * is caught and counted as a skip.
 *
 * Usage: node scripts/backfill-billing-permission.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BILLING_PERM = {
  resource: 'settings',
  action: 'billing',
  scope: 'global',
}

function parsePermissionString(perm) {
  const parts = perm.split(':')
  return {
    resource: parts[0] || '',
    action: parts[1] || '',
    scope: parts[2] || 'global',
  }
}

async function main() {
  // 1. Upsert the settings:billing permission row (global table, no orgId)
  const permRow = await prisma.permission.upsert({
    where: { resource_action_scope: BILLING_PERM },
    create: BILLING_PERM,
    update: {},
  })
  console.log(`Permission row id: ${permRow.id} (settings:billing:global)`)

  // 2. Find all admin roles across all orgs
  //    (super-admin has *:* wildcard and already covers settings:billing — skip it)
  const adminRoles = await prisma.role.findMany({
    where: { slug: 'admin' },
    select: { id: true, organizationId: true },
  })
  console.log(`Found ${adminRoles.length} admin role(s) across all organizations`)

  let added = 0
  let skipped = 0

  for (const role of adminRoles) {
    try {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permRow.id,
        },
      })
      added++
    } catch (err) {
      // P2002 = unique constraint violation — RolePermission already exists
      if (err?.code === 'P2002') {
        skipped++
      } else {
        throw err
      }
    }
  }

  console.log(`Done: added=${added}, skipped=${skipped}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
