/**
 * E2E Test User Setup Script
 *
 * Creates two test users on the staging/production database for the E2E test suite:
 *   1. e2e-admin@lionheart-test.com — super-admin role (full access)
 *   2. e2e-member@lionheart-test.com — member role (limited access)
 *
 * Optionally creates Org B + admin for tenant-isolation tests.
 *
 * Safe to run multiple times — uses upserts. Updates passwords on every run.
 *
 * Usage:
 *   npx dotenv -e .env -- node scripts/setup-e2e-users.mjs          # remote
 *   npx dotenv -e .env.local -e .env -- node scripts/setup-e2e-users.mjs  # local
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── Config ──────────────────────────────────────────────────────────────────

const ORG_A_SLUG = 'linfield-christian-school'
const ADMIN_EMAIL = 'e2e-admin@lionheart-test.com'
const MEMBER_EMAIL = 'e2e-member@lionheart-test.com'
const E2E_PASSWORD = 'E2E-Test-P@ssw0rd-2026!'

const ORG_B_SLUG = 'e2e-org-b'
const ORG_B_NAME = 'E2E Org B (isolation tests)'
const ORG_B_ADMIN_EMAIL = 'e2e-admin@org-b-test.com'
const ORG_B_PASSWORD = 'E2E-OrgB-P@ssw0rd-2026!'

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 E2E Test User Setup — Starting...\n')

  // ─── Org A ─────────────────────────────────────────────────────────────
  const orgA = await prisma.organization.findFirst({
    where: { slug: ORG_A_SLUG },
    select: { id: true, name: true },
  })

  if (!orgA) {
    console.error(`❌ Organization with slug "${ORG_A_SLUG}" not found.`)
    console.error('   Create the org first (via /signup or seed script).')
    process.exit(1)
  }

  console.log(`📍 Org A: ${orgA.name} (${orgA.id})\n`)

  // Find the super-admin and member roles for this org
  // Role names can be either kebab-case ("super-admin") or title-case ("Super Admin")
  const superAdminRole = await prisma.role.findFirst({
    where: { organizationId: orgA.id, name: { in: ['super-admin', 'Super Admin'] } },
    select: { id: true },
  })
  const memberRole = await prisma.role.findFirst({
    where: { organizationId: orgA.id, name: { in: ['member', 'Member'] } },
    select: { id: true },
  })

  if (!superAdminRole || !memberRole) {
    console.error('❌ Could not find super-admin and member roles. Run seedOrgDefaults first.')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10)

  // Upsert admin user
  const admin = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgA.id, email: ADMIN_EMAIL } },
    create: {
      organizationId: orgA.id,
      email: ADMIN_EMAIL,
      firstName: 'E2E',
      lastName: 'Admin',
      passwordHash,
      roleId: superAdminRole.id,
      status: 'ACTIVE',
      emailVerified: true,
    },
    update: {
      passwordHash,
      roleId: superAdminRole.id,
      status: 'ACTIVE',
      emailVerified: true,
      deletedAt: null,
    },
    select: { id: true, email: true },
  })
  console.log(`  ✓ Admin: ${admin.email} (${admin.id}) — super-admin`)

  // Upsert member user
  const member = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgA.id, email: MEMBER_EMAIL } },
    create: {
      organizationId: orgA.id,
      email: MEMBER_EMAIL,
      firstName: 'E2E',
      lastName: 'Member',
      passwordHash,
      roleId: memberRole.id,
      status: 'ACTIVE',
      emailVerified: true,
    },
    update: {
      passwordHash,
      roleId: memberRole.id,
      status: 'ACTIVE',
      emailVerified: true,
      deletedAt: null,
    },
    select: { id: true, email: true },
  })
  console.log(`  ✓ Member: ${member.email} (${member.id}) — member`)

  // ─── Org B (optional, for tenant isolation tests) ──────────────────────
  console.log('\n📍 Setting up Org B for isolation tests...\n')

  let orgB = await prisma.organization.findFirst({
    where: { slug: ORG_B_SLUG },
    select: { id: true, name: true },
  })

  if (!orgB) {
    orgB = await prisma.organization.create({
      data: {
        name: ORG_B_NAME,
        slug: ORG_B_SLUG,
      },
      select: { id: true, name: true },
    })
    console.log(`  ✓ Created Org B: ${orgB.name} (${orgB.id})`)

    // Seed default roles + permissions for Org B by copying from Org A
    const orgARoles = await prisma.role.findMany({
      where: { organizationId: orgA.id },
      select: { id: true, name: true, slug: true, description: true, isSystem: true, permissions: { select: { permissionId: true } } },
    })
    for (const role of orgARoles) {
      const newRole = await prisma.role.create({
        data: {
          organizationId: orgB.id,
          name: role.name,
          slug: role.slug || role.name.toLowerCase().replace(/\s+/g, '-'),
          description: role.description,
          isSystem: role.isSystem,
        },
      })
      for (const rp of role.permissions) {
        await prisma.rolePermission.create({
          data: { roleId: newRole.id, permissionId: rp.permissionId },
        }).catch(() => { /* permission may already be linked */ })
      }
    }
    console.log('  ✓ Seeded roles & permissions for Org B')
  } else {
    console.log(`  · Org B already exists: ${orgB.name} (${orgB.id})`)
  }

  // Ensure Org B has roles — seed from Org A if empty
  const orgBRoleCount = await prisma.role.count({ where: { organizationId: orgB.id } })
  if (orgBRoleCount === 0) {
    const orgARoles = await prisma.role.findMany({
      where: { organizationId: orgA.id },
      select: { name: true, slug: true, description: true, isSystem: true, permissions: { select: { permissionId: true } } },
    })
    for (const role of orgARoles) {
      const newRole = await prisma.role.create({
        data: {
          organizationId: orgB.id,
          name: role.name,
          slug: role.slug || role.name.toLowerCase().replace(/\s+/g, '-'),
          description: role.description,
          isSystem: role.isSystem,
        },
      })
      for (const rp of role.permissions) {
        await prisma.rolePermission.create({
          data: { roleId: newRole.id, permissionId: rp.permissionId },
        }).catch(() => {})
      }
    }
    console.log(`  ✓ Seeded ${orgARoles.length} roles for Org B`)
  }

  const orgBAdminRole = await prisma.role.findFirst({
    where: { organizationId: orgB.id, name: { in: ['super-admin', 'Super Admin'] } },
    select: { id: true },
  })

  if (orgBAdminRole) {
    const orgBPasswordHash = await bcrypt.hash(ORG_B_PASSWORD, 10)
    const orgBAdmin = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: orgB.id, email: ORG_B_ADMIN_EMAIL } },
      create: {
        organizationId: orgB.id,
        email: ORG_B_ADMIN_EMAIL,
        firstName: 'E2E',
        lastName: 'Org-B Admin',
        passwordHash: orgBPasswordHash,
        roleId: orgBAdminRole.id,
        status: 'ACTIVE',
        emailVerified: true,
      },
      update: {
        passwordHash: orgBPasswordHash,
        roleId: orgBAdminRole.id,
        status: 'ACTIVE',
        emailVerified: true,
        deletedAt: null,
      },
      select: { id: true, email: true },
    })
    console.log(`  ✓ Org B Admin: ${orgBAdmin.email} (${orgBAdmin.id})`)
  }

  // ─── Output .env.e2e values ────────────────────────────────────────────
  console.log('\n─── Copy these into .env.e2e ───────────────────────\n')
  console.log(`E2E_ORG_A_SLUG=${ORG_A_SLUG}`)
  console.log(`E2E_ORG_A_ID=${orgA.id}`)
  console.log(`E2E_ADMIN_EMAIL=${ADMIN_EMAIL}`)
  console.log(`E2E_ADMIN_PASSWORD=${E2E_PASSWORD}`)
  console.log(`E2E_MEMBER_EMAIL=${MEMBER_EMAIL}`)
  console.log(`E2E_MEMBER_PASSWORD=${E2E_PASSWORD}`)
  console.log(`E2E_ORG_B_SLUG=${ORG_B_SLUG}`)
  console.log(`E2E_ORG_B_ID=${orgB.id}`)
  console.log(`E2E_ORG_B_ADMIN_EMAIL=${ORG_B_ADMIN_EMAIL}`)
  console.log(`E2E_ORG_B_ADMIN_PASSWORD=${ORG_B_PASSWORD}`)
  console.log('')
  console.log('✅ E2E test users ready.')
}

main()
  .catch((e) => {
    console.error('❌ Setup failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
