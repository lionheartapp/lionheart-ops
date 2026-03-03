#!/usr/bin/env node
/**
 * backfill-new-roles.mjs
 * Seeds the 4 new roles (Athletic Director, Coach, Board Member, Parent)
 * into all existing organizations that don't already have them.
 *
 * Usage: node scripts/backfill-new-roles.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NEW_ROLES = [
  {
    slug: 'athletic-director',
    name: 'Athletic Director',
    description: 'Manages athletic programs, approves games and tournaments',
    permissions: [
      'athletics:manage', 'athletics:games:create', 'athletics:games:approve',
      'athletics:games:score', 'athletics:practices:create', 'athletics:practices:approve',
      'athletics:tournaments:manage', 'athletics:teams:manage', 'athletics:read',
      'calendars:read', 'calendars:create', 'calendar-events:create',
      'calendar-events:read', 'calendar-events:update:all', 'calendar-events:delete:all',
      'calendar-events:approve', 'academic:read', 'planning:view',
      'resource-requests:create', 'resource-requests:read:all', 'resource-requests:respond',
      'settings:read', 'users:read', 'teams:read',
    ],
  },
  {
    slug: 'coach',
    name: 'Coach',
    description: 'Creates games and practices, scores games for assigned teams',
    permissions: [
      'athletics:games:create', 'athletics:games:score', 'athletics:practices:create',
      'athletics:read', 'calendars:read', 'calendar-events:create:own-calendar',
      'calendar-events:read', 'calendar-events:update:own', 'calendar-events:delete:own',
      'academic:read', 'planning:view', 'resource-requests:create',
      'resource-requests:read:own', 'settings:read',
    ],
  },
  {
    slug: 'board-member',
    name: 'Board Member',
    description: 'Read-only access to calendars, planning, and athletics',
    permissions: [
      'calendars:read', 'calendar-events:read', 'academic:read',
      'planning:view', 'athletics:read', 'settings:read',
    ],
  },
  {
    slug: 'parent',
    name: 'Parent',
    description: 'Read-only access to public-facing calendars and academics',
    permissions: [
      'calendars:read', 'calendar-events:read', 'academic:read', 'athletics:read',
    ],
  },
]

function parsePermissionString(perm) {
  const parts = perm.split(':')
  return {
    resource: parts[0] || '',
    action: parts[1] || '',
    scope: parts[2] || 'global',
  }
}

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } })
  console.log(`Found ${orgs.length} organization(s)`)

  // Collect and upsert all permission rows
  const allPermStrings = [...new Set(NEW_ROLES.flatMap((r) => r.permissions))]
  for (const perm of allPermStrings) {
    const { resource, action, scope } = parsePermissionString(perm)
    await prisma.permission.upsert({
      where: { resource_action_scope: { resource, action, scope } },
      create: { resource, action, scope },
      update: {},
    })
  }
  console.log(`Upserted ${allPermStrings.length} permission rows`)

  for (const org of orgs) {
    console.log(`\nProcessing org: ${org.name} (${org.id})`)

    for (const roleDef of NEW_ROLES) {
      const existing = await prisma.role.findUnique({
        where: { organizationId_slug: { organizationId: org.id, slug: roleDef.slug } },
      })
      if (existing) {
        console.log(`  Role "${roleDef.slug}" already exists — skipping`)
        continue
      }

      // Resolve permission IDs
      const permIds = []
      for (const perm of roleDef.permissions) {
        const { resource, action, scope } = parsePermissionString(perm)
        const row = await prisma.permission.findUnique({
          where: { resource_action_scope: { resource, action, scope } },
        })
        if (row) permIds.push(row.id)
      }

      await prisma.role.create({
        data: {
          organizationId: org.id,
          name: roleDef.name,
          slug: roleDef.slug,
          description: roleDef.description,
          isSystem: true,
          permissions: {
            create: permIds.map((pid) => ({ permissionId: pid })),
          },
        },
      })
      console.log(`  Created role "${roleDef.slug}" with ${permIds.length} permissions`)
    }
  }

  console.log('\nDone!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
