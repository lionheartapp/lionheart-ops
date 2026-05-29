#!/usr/bin/env tsx
/**
 * Sync default role permissions for existing organizations.
 *
 * New organizations get the latest DEFAULT_ROLES permissions during signup.
 * Older organizations can miss permissions added after they were created. This
 * script adds any missing default permission links without removing custom
 * permissions.
 *
 * Usage:
 *   npx dotenv -e .env.local -e .env -- npx tsx scripts/sync-default-role-permissions.ts
 *   ORG_ID=... npx dotenv -e .env.local -e .env -- npx tsx scripts/sync-default-role-permissions.ts
 */
import { PrismaClient } from '@prisma/client'
import { DEFAULT_ROLES } from '../src/lib/permissions'

const prisma = new PrismaClient()

function parsePermissionString(perm: string): { resource: string; action: string; scope: string } {
  const parts = perm.split(':')
  return {
    resource: parts[0] ?? '*',
    action: parts[1] ?? '*',
    scope: parts[2] ?? 'global',
  }
}

async function syncRole(orgId: string, roleDef: (typeof DEFAULT_ROLES)[keyof typeof DEFAULT_ROLES]) {
  const role = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: orgId, slug: roleDef.slug } },
    create: {
      organizationId: orgId,
      slug: roleDef.slug,
      name: roleDef.name,
      description: roleDef.description,
      isSystem: roleDef.isSystem,
    },
    update: {
      name: roleDef.name,
      description: roleDef.description,
      isSystem: roleDef.isSystem,
    },
    select: { id: true, slug: true },
  })

  let added = 0
  let skipped = 0

  for (const permission of roleDef.permissions) {
    const parts = parsePermissionString(permission)
    const row = await prisma.permission.upsert({
      where: { resource_action_scope: parts },
      create: parts,
      update: {},
      select: { id: true },
    })

    try {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: row.id },
      })
      added++
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
        skipped++
        continue
      }
      throw error
    }
  }

  return { slug: role.slug, added, skipped }
}

async function main() {
  const orgFilter = process.env.ORG_ID ? { id: process.env.ORG_ID } : {}
  const orgs = await prisma.organization.findMany({
    where: orgFilter,
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: 'asc' },
  })

  if (orgs.length === 0) {
    throw new Error(process.env.ORG_ID ? `No organization found for ORG_ID=${process.env.ORG_ID}` : 'No organizations found')
  }

  let totalAdded = 0
  let totalSkipped = 0

  for (const org of orgs) {
    console.log(`Syncing ${org.name} (${org.slug})`)
    for (const roleDef of Object.values(DEFAULT_ROLES)) {
      const result = await syncRole(org.id, roleDef)
      totalAdded += result.added
      totalSkipped += result.skipped
      console.log(`  ${result.slug}: added=${result.added}, already_present=${result.skipped}`)
    }
  }

  console.log(`Done: organizations=${orgs.length}, added=${totalAdded}, already_present=${totalSkipped}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
