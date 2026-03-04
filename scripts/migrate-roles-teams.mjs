#!/usr/bin/env node
/**
 * One-time migration: Add Teacher role + Security team to existing orgs.
 *
 * - For each org, creates a "teacher" role (if missing) with the correct permissions.
 * - For each org, creates a "security" team (if missing).
 * - Existing "Teachers" teams are left untouched.
 *
 * Run: node scripts/migrate-roles-teams.mjs
 */

import { PrismaClient } from '@prisma/client'

// Use DIRECT_URL to bypass PgBouncer (avoids prepared statement issues)
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
})

// Teacher role permission strings (must match DEFAULT_ROLES.TEACHER in permissions.ts)
const TEACHER_PERMISSIONS = [
  'tickets:create',
  'tickets:read:own',
  'tickets:update:own',
  'events:read',
  'settings:read',
  'calendars:read',
  'calendar-events:create:own-calendar',
  'calendar-events:read',
  'calendar-events:update:own',
  'calendar-events:delete:own',
  'academic:read',
  'planning:submit',
  'planning:view',
  'planning:comment',
  'resource-requests:create',
  'resource-requests:read:own',
  'athletics:read',
]

function parsePermissionString(perm) {
  const parts = perm.split(':')
  return {
    resource: parts[0] ?? '*',
    action:   parts[1] ?? '*',
    scope:    parts[2] ?? 'global',
  }
}

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } })
  console.log(`Found ${orgs.length} organization(s).\n`)

  for (const org of orgs) {
    console.log(`── ${org.name} (${org.id}) ──`)

    // ── Teacher role ──
    const existingTeacherRole = await prisma.role.findFirst({
      where: { organizationId: org.id, slug: 'teacher' },
      select: { id: true },
    })

    if (existingTeacherRole) {
      console.log('  Teacher role already exists — skipping.')
    } else {
      // Upsert permission rows sequentially (pooler can't handle parallel prepared statements)
      const permissionMap = new Map()
      for (const permString of TEACHER_PERMISSIONS) {
        const { resource, action, scope } = parsePermissionString(permString)
        const row = await prisma.permission.upsert({
          where: { resource_action_scope: { resource, action, scope } },
          create: { resource, action, scope },
          update: {},
          select: { id: true },
        })
        permissionMap.set(permString, row.id)
      }

      await prisma.role.create({
        data: {
          organizationId: org.id,
          name: 'Teacher',
          slug: 'teacher',
          description: 'Teaching staff — classroom and personal calendar access',
          isSystem: true,
          permissions: {
            create: TEACHER_PERMISSIONS.map((permString) => ({
              permissionId: permissionMap.get(permString),
            })),
          },
        },
      })
      console.log('  ✓ Teacher role created.')
    }

    // ── Security team ──
    const existingSecurityTeam = await prisma.team.findFirst({
      where: { organizationId: org.id, slug: 'security' },
      select: { id: true },
    })

    if (existingSecurityTeam) {
      console.log('  Security team already exists — skipping.')
    } else {
      await prisma.team.create({
        data: {
          organizationId: org.id,
          name: 'Security',
          slug: 'security',
          description: 'Campus security and access control',
          teamType: null,
        },
      })
      console.log('  ✓ Security team created.')
    }

    console.log()
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
